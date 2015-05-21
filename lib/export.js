
require('org.pinf.genesis.lib/lib/api').forModule(require, module, function (API, exports) {

	exports.export = function (sourcePath, targetPath, form) {

        return API.Q.denodeify(function(callback) {

			return API.FS.exists(sourcePath, function (exists) {
				if (!exists) return callback(new Error("'sourcePath' (" + sourcePath + ") does not exist!"));

				function ensureTargetExists (callback) {
					return API.FS.exists(targetPath, function (exists) {
						if (exists) return callback(null);
						return API.FS.mkdirs(targetPath, callback);
					});
				}

				function indexSource (callback) {
					// TODO: Use existing index from more general form (e.g. .pit.meta) if it exists.
					var walker = new API.FSWALKER.Walker(sourcePath);
                    var opts = {};                
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
                        return callback(null, paths);
                    });
				}

				return ensureTargetExists(function (err) {
					if (err) return callback(err);

					return indexSource(function (err, paths) {
						if (err) return callback(err);

						// NEVER: Add any logic to modify what is being copied!
						//        This is not the place for that. Use the pio.postdeploy
						//        sequence to modify the source as needed.

                        var sourcePathLength = sourcePath.length;
                        return API.NCP(sourcePath, targetPath, {
                            stopOnErr: true,
                            filter: function(filepath) {
                                var path = filepath.substring(sourcePathLength);
                                if (!path) return true;
                                return (!!paths[path]);
                            }
                        }, function (err) {
                            if (err) {
                                // TODO: Make sure error is formatted correctly.
                                console.error("ERR", err);
                                return callback(err);
                            }

                            // Lock the export to represent a specific form of the source.
                            var path = API.PATH.join(targetPath, ".smg.form.json");
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
                });
            });
        })();
	}

	exports.addFile = function (path, data) {
        return API.Q.denodeify(function(callback) {
        	return API.FS.exists(path, function (exists) {
        		if (exists) {
        			return callback(new Error("Cannot add file '" + path + "' as it already exists!"));
        		}
        		function findMeta (callback) {
        			// TODO: Make *traversing up the fs tree to look for dir/file* a common pattern in org.pinf.genesis.lib
        			function find (path, callback) {
        				return API.FS.exists(API.PATH.join(path, ".smg.form.json"), function (exists) {
        					if (exists) {
        						return callback(null, API.PATH.join(path, ".smg.form.json"));
        					}
        					var nawPath = API.PATH.dirname(path);
        					if (newPath === path) {
        						return callback(null, null);
        					}
        					return find(newPath, callback);
        				});
        			}
        			return find(API.PATH.dirname(path), callback);
        		}
        		return API.FS.outputFile(path, data, function (err) {
        			if (err) return callback(err);

        			return findMeta(function (err, metaPath) {
        				if (err) return callback(err);
        				if (!metaPath) {
        					return callback(new Error("Could not add file '" + path + "' as no '.smg.form.json' file found in parent dirs."));
        				}
	        			return API.FS.readFile(metaPath, "utf8", function (err, data) {
		        			if (err) return callback(err);
		        			var descriptor = JSON.parse(data);
		        			return API.FS.stat(path, function (err, stat) {
			        			if (err) return callback(err);
			        			descriptor.config['org.sourcemint.genesis.lib/form/0'].paths["/" + API.PATH.relative(API.PATH.dirname(metaPath), path)] = {
			        				size: stat.size
			        			};
			        			return API.FS.writeFile(metaPath, JSON.stringify(descriptor, null, 4), "utf8", callback);
		        			});
	        			});
        			});
        		});
        	});
        })();
	}

});

