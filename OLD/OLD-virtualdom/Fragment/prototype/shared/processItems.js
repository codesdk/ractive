export default function processItems ( items, values, guid, counter ) {
	counter = counter || 0;

	return items.map( function ( item ) {
		var placeholderId, wrapped, value;

		if ( item.text ) {
			return item.text;
		}

		if ( item.fragments ) {
			return item.fragments.map( function ( fragment ) {
				return processItems( fragment.items, values, guid, counter );
			}).join( '' );
		}

		placeholderId = guid + '-' + counter++;

		if ( item.context && ( wrapped = item.context.wrapper ) ) {
			value = wrapped.value;
		} else {
			value = item.getValue();
		}

		values[ placeholderId ] = value;

		return '${' + placeholderId + '}';
	}).join( '' );
}