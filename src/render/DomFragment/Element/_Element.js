define([
	'config/types',
	'config/namespaces',
	'config/voidElementNames',
	'utils/create',
	'utils/defineProperty',
	'utils/warn',
	'render/DomFragment/Element/getElementNamespace',
	'render/DomFragment/Element/createElementAttributes',
	'render/DomFragment/Element/appendElementChildren',
	'render/DomFragment/Element/bindElement',
	'render/DomFragment/Element/executeTransition',
	'render/DomFragment/Element/decorate',
	'render/DomFragment/Element/addEventProxies',
	'render/DomFragment/shared/enforceCase'
], function (
	types,
	namespaces,
	voidElementNames,
	create,
	defineProperty,
	warn,
	getElementNamespace,
	createElementAttributes,
	appendElementChildren,
	bindElement,
	executeTransition,
	decorate,
	addEventProxies,
	enforceCase
) {
	
	'use strict';

	var DomElement = function ( options, docFrag ) {

		var self = this,
			parentFragment,
			contextStack,
			descriptor,
			namespace,
			name,
			attributes,
			width,
			height,
			loadHandler,
			root;

		this.type = types.ELEMENT;

		// stuff we'll need later
		parentFragment = this.parentFragment = options.parentFragment;
		contextStack = parentFragment.contextStack;
		descriptor = this.descriptor = options.descriptor;

		this.root = root = parentFragment.root;
		this.pNode = parentFragment.pNode;
		this.index = options.index;

		this.eventListeners = [];
		this.customEventListeners = [];

		// get namespace, if we're actually rendering (not server-side stringifying)
		if ( this.pNode ) {
			namespace = this.namespace = getElementNamespace( descriptor, this.pNode );

			// non-HTML elements (i.e. SVG) are case-sensitive
			name = ( namespace !== namespaces.html ? enforceCase( descriptor.e ) : descriptor.e );

			// create the DOM node
			this.node = document.createElementNS( namespace, name );

			// Add _ractive property to the node - we use this object to store stuff
			// related to proxy events, two-way bindings etc
			defineProperty( this.node, '_ractive', {
				value: {
					keypath: ( contextStack.length ? contextStack[ contextStack.length - 1 ] : '' ),
					index: parentFragment.indexRefs,
					events: create( null ),
					root: root
				}
			});
		}


		// set attributes
		attributes = createElementAttributes( this, descriptor.a );


		// append children, if there are any
		if ( descriptor.f ) {
			appendElementChildren( this, this.node, descriptor, docFrag );
		}


		// create event proxies
		if ( docFrag && descriptor.v ) {
			addEventProxies( this, descriptor.v );
		}

		// if we're actually rendering (i.e. not server-side stringifying), proceed
		if ( docFrag ) {
			// deal with two-way bindings
			if ( root.twoway ) {
				bindElement( this, attributes );
			}

			// name attributes are deferred, because they're a special case - if two-way
			// binding is involved they need to update later. But if it turns out they're
			// not two-way we can update them now
			if ( attributes.name && !attributes.name.twoway ) {
				attributes.name.update();
			}

			// if this is an <img>, and we're in a crap browser, we may need to prevent it
			// from overriding width and height when it loads the src
			if ( this.node.tagName === 'IMG' && ( ( width = self.attributes.width ) || ( height = self.attributes.height ) ) ) {
				this.node.addEventListener( 'load', loadHandler = function () {
					if ( width ) {
						self.node.width = width.value;
					}

					if ( height ) {
						self.node.height = height.value;
					}

					self.node.removeEventListener( 'load', loadHandler, false );
				}, false );
			}

			docFrag.appendChild( this.node );

			// apply decorator(s)
			if ( descriptor.o ) {
				decorate( descriptor.o, root, this, contextStack );
			}

			// trigger intro transition
			if ( descriptor.t1 ) {
				executeTransition( descriptor.t1, root, this, contextStack, true );
			}

			// Special case... a select may have had its value set before a matching
			// option was rendered. This might be that option element
			if ( this.node.tagName === 'OPTION' ) {
				if ( this.node._ractive.value == this.pNode._ractive.value ) {
					this.node.selected = true;
				}
			}
		}
	};

	DomElement.prototype = {
		teardown: function ( detach ) {
			var eventName, binding, bindings;

			// Children first. that way, any transitions on child elements will be
			// handled by the current transitionManager
			if ( this.fragment ) {
				this.fragment.teardown( false );
			}

			while ( this.attributes.length ) {
				this.attributes.pop().teardown();
			}

			if ( this.node._ractive ) {
				for ( eventName in this.node._ractive.events ) {
					this.node._ractive.events[ eventName ].teardown();
				}

				// tear down two-way binding, if such there be
				if ( binding = this.node._ractive.binding ) {
					binding.teardown();

					bindings = this.root._twowayBindings[ binding.attr.keypath ];
					bindings.splice( bindings.indexOf( binding ), 1 );
				}
			}

			if ( this.decorator ) {
				this.decorator.teardown();
			}

			if ( this.descriptor.t2 ) {
				executeTransition( this.descriptor.t2, this.root, this, this.parentFragment.contextStack, false );
			}

			if ( detach ) {
				this.root._transitionManager.detachWhenReady( this.node );
			}
		},

		firstNode: function () {
			return this.node;
		},

		findNextNode: function () {
			return null;
		},

		// TODO can we get rid of this?
		bubble: function () {}, // just so event proxy and transition fragments have something to call!

		toString: function () {
			var str, i, len;

			str = '<' + ( this.descriptor.y ? '!doctype' : this.descriptor.e );

			len = this.attributes.length;
			for ( i=0; i<len; i+=1 ) {
				str += ' ' + this.attributes[i].toString();
			}

			str += '>';

			if ( this.html ) {
				str += this.html;
			} else if ( this.fragment ) {
				str += this.fragment.toString();
			}

			// add a closing tag if this isn't a void element
			if ( voidElementNames.indexOf( this.descriptor.e ) === -1 ) {
				str += '</' + this.descriptor.e + '>';
			}

			return str;
		}
	};

	return DomElement;

});