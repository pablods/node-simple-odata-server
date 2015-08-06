

function getModelDef(model){

    var def = {};
    for (var entityName in model.entityTypes){
        def[entityName] = {};
        for(var propName in model.entityTypes[entityName]){
            if(propName == "no_prune"){
                def[entityName].no_prune = model.entityTypes[entityName][propName];
                continue;
            }
            def[entityName][propName] = parsePropDef(model.entityTypes[entityName][propName], model);
        }
    }

    for (var complexName in model.complexTypes){
        def[complexName] = {};
        for(var propName in model.complexTypes[complexName]){
            if(propName == "no_prune"){
                def[complexName].no_prune = model.complexTypes[complexName][propName];
                continue;
            }
            def[complexName][propName] = parsePropDef(model.complexTypes[complexName][propName], model);
        }
    }

    return def;
}

function parsePropDef(propDef, model) {

    var def = {};

    if (propDef.type.indexOf("Collection") === 0) {
        def.type = 'Collection';

        if (propDef.type.indexOf("Collection(Edm") === 0) {
            def.subTypeType = 'Edm';
            //to add name
            def.subTypeName = '';
            return def;
        }

        var complexTypeName = propDef.type.replace("Collection(" + model.namespace + ".", "");
        complexTypeName = complexTypeName.substring(0, complexTypeName.length - 1);
        var complexType = model.complexTypes[complexTypeName];
        if (!complexType)
            throw new Error("Complex type " + complexTypeName + " was not found.");


        def.subTypeType = "Complex";
        def.subTypeName = complexTypeName;

        return def;
    }


    if (propDef.type.indexOf("Edm") !== 0) {
        var complexTypeName = propDef.type.replace(model.namespace + ".", "");
        var complexType = model.complexTypes[complexTypeName];
        if (!complexType)
            throw new Error("Complex type " + complexTypeName + " was not found.");


        def.type = "Complex";
        def.name = complexTypeName;
        return def;
    }

    def.type = "Edm";
    //to add name
    def.name = '';
    return def;
}


function prune(doc, def, type) {

    if (doc instanceof Array) {
        for (var i in doc) {
            prune(doc[i], def, type);
        }
        return;
    }


    for (var prop in doc) {
        if (!prop || doc[prop] === undefined)
            continue;

        if(prop.charAt(0) == '@'){
            continue;
        }

        var propDef = def[type][prop];

        if (!propDef) {
            delete doc[prop];
            continue;
        }

        if (propDef.type == "Edm"){
            continue;
        }
        else if (propDef.type == "Collection") {
            if(prop.subTypeType == "Edm"){
                continue;
            }
            if(def[propDef.subTypeName].no_prune){
                continue;
            }

            for (var i in doc[prop]) {
                prune(doc[prop][i], def, propDef.subTypeName);
            }
            continue;
        }
        else if (propDef.type == "Complex") {
            prune(doc[prop], def, propDef.name);
        }
    }
}

module.exports = function(model, collection, docs) {

    console.log("start: " + (new Date().getTime())/1000);

    var entitySet = model.entitySets[collection];
    var entityType = entitySet.entityType.replace(model.namespace + ".", "");
    var def = getModelDef(model);
    console.log("start: " + (new Date().getTime())/1000);

    var start = new Date().getTime();
    for (var i in docs) {
        prune(docs, def, entityType);
    }
    var end = new Date().getTime();
    console.log((end-start)/1000);
};