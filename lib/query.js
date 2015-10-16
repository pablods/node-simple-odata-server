/*!
 * Copyright(c) 2014 Jan Blaha (pofider)
 *
 * Orchestrate the OData query GET requests
 */

var parser = require("odata-parser");
var queryTransform = require("./queryTransform.js");
var url = require("url");
var querystring = require("querystring");
var _ = require("underscore");

module.exports = function(cfg, req, res) {

    if (!cfg.model.entitySets[req.params.collection]) {
        var error = new Error("Entity set not Found");
        error.status = 404;
        res.odataError(error);
        return;
    }

    var queryOptions = { $filter: {}};

    var _url = url.parse(req.url, true);
    if (_url.search) {
        var query = _url.query;
        var fixedQS = {};
        if (query.$) fixedQS.$ = query.$;
        if (query.$expand) fixedQS.$expand = query.$expand;
        if (query.$filter) fixedQS.$filter = query.$filter;
        if (query.$format) fixedQS.$format = query.$format;
        if (query.$inlinecount) fixedQS.$inlinecount = query.$inlinecount;
        if (query.$select) fixedQS.$select = query.$select;
        if (query.$skip) fixedQS.$skip = query.$skip;
        if (query.$top) fixedQS.$top = query.$top;
        if (query.$orderby) fixedQS.$orderby = query.$orderby;

        var encodedQS = decodeURIComponent(querystring.stringify(fixedQS));
        if (encodedQS) {
            var parsedOption = parser.parse(encodedQS)
            if(parsedOption.error){
                var error = new Error("Bad request: "+parsedOption.error);
                error.status = 400;
                return res.odataError(error);
            }

            queryOptions = queryTransform(parsedOption);
        }
        if (query.$count) {
            queryOptions.$inlinecount = true;
        }
    }

    queryOptions.collection = req.params.collection;

    if (req.params.$count) {
        queryOptions.$count = true;
    }

    if (req.params.id) {
        req.params.id = req.params.id.replace(/\"/g, "").replace(/'/g, "");
        queryOptions.$filter = { _id: req.params.id};
    }else if(!queryOptions.$limit || queryOptions.$limit <= 0){
        queryOptions.$limit = cfg.defaultTop;
    }

    cfg.executeQuery(queryOptions.collection, queryOptions, function(err, result) {
        if (err) {
            return res.odataError(err);
        }

        res.writeHead(200, {'Content-Type': 'application/json', 'OData-Version': '4.0'});

        var out = {
            "@odata.context": cfg.serviceUrl + "/$metadata#" + req.params.collection
        }

        if(req.params.id){
            if(result.length == 0){
                //404
            }else{
                _.extend(out, result[0]);
            }
        }
        else{
            if (queryOptions.$inlinecount) {
                out["@odata.count"] = result.count;
                out.value = result.value;
            }else{
                out.value = result;
            }
        }


        if(req.params.id){
            cfg.pruneResults(queryOptions.collection, out);
            //cfg.bufferToBase64(queryOptions.collection, out);
        }else{
            cfg.pruneResults(queryOptions.collection, out.value);

            //cfg.bufferToBase64(queryOptions.collection, out.value);
        }

        return res.end(JSON.stringify(out));
    });
};
