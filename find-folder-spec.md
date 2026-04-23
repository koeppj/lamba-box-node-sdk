# Find Folder Function

Function Name: `find-box-folder`
Method: `get`

The Find Folder Function utilizes the [Box Search API](https://developer.box.com/reference/get-search) to
find Box folder(3) that with a given name.  It operates in two modes based on which or two query params
are provided.  

The function accepts two query params.

* name - a required string value representing the name to search for
* mode - an optional enum with values of `native` or `exact` with a default of `native`

In native search mode, the function calls the Box Search API and returns, as a json array, all search entries returned
by the search api using provided `name` query param value as the api `query` param and filtering by `content_types=[name]` 
and `type=folder`. The API query param value is wrapped in the double qoutes (`"`).  

In exact search mode, the function performs the same Box api call as done in the `native` mode  but then 
filters the returned search entries by performing only those entries where the entry[n].name == <name function arg>.