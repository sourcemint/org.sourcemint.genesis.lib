
require('org.pinf.genesis.lib/lib/api').forModule(require, module, function (API, exports) {

	exports.indexAndWriteForm = function (basePath, form) {

        return API.Q.denodeify(function(callback) {

			return API.FS.exists(basePath, function (exists) {
				if (!exists) return callback(new Error("'basePath' (" + basePath + ") does not exist!"));

				// TODO: Use existing index from more general form (e.g. .pit.meta) if it exists.
				var walker = new API.FSWALKER.Walker(basePath);
                var opts = {};
                opts.ignore = [
                    "/.smg.form.json"
                ];
                if (form === "asis") {
                    opts.returnIgnoredFiles = true;
                    opts.includeDependencies = true;
                    opts.respectDistignore = false;
                    opts.respectNestedIgnore = false;
                    opts.excludeMtime = true;
                } else
                if (form === "snapshot") {
                    opts.returnIgnoredFiles = false;
                    opts.includeDependencies = false;
                    opts.respectDistignore = true;
                    opts.respectNestedIgnore = true;
                    opts.excludeMtime = true;
                } else {
                	return callback(new Error("Form '" + form + "' not supported!"));
                }
                return walker.walk(opts, function(err, paths) {
                    if (err) return callback(err);

                    // Lock the export to represent a specific form of the source.
                    var path = API.PATH.join(basePath, ".smg.form.json");
                    return API.FS.outputFile(path, JSON.stringify({
                        "config": {
                            "org.sourcemint.genesis.lib/form/0": {
                                "type": form,
                                "paths": paths
                            }
                        }
                    }, null, 4), callback);
                });
            });
        })();
	}

});

