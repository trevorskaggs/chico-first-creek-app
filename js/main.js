// Global Variables
var marker = null,
    map = null,
    cl = null,
    dropzone_before = null,
    dropzone_after = null,
    carto_id = null,
    holdMarker = null,
    array = [];

// Loads config.js file
Config = {

    basemaps: {
        street: {
            id: "Street",
            url: "https:\/\/a.tiles.mapbox.com\/v4\/mapbox.streets\/{z}\/{x}\/{y}.png?access_token=pk.eyJ1IjoiZG1lc3NlcnNjaG1pZHQiLCJhIjoiY2owbDVjb2diMDM4NjMycWR3ZXFhbWdxbiJ9.MhmdiVKn0f3Z0PFhSYtD4A"
        },
        satelliteHybrid: {
            id: "Satellite Hybrid",
            url: "https:\/\/b.tiles.mapbox.com\/v4\/mapbox.streets-satellite\/{z}\/{x}\/{y}.png?access_token=pk.eyJ1IjoiZG1lc3NlcnNjaG1pZHQiLCJhIjoiY2owbDVjb2diMDM4NjMycWR3ZXFhbWdxbiJ9.MhmdiVKn0f3Z0PFhSYtD4A"
        },
    },

    basemapDefault: "satelliteHybrid",

    map: {
        bounds: {
            _northEast: {
                lat: 39.8465036024177, 
                lng: -121.72611236572267,
            },
            _southWest: {
                lat: 39.60304299778908, 
                lng: -121.87751770019533
            }
        },
        inertia: 2000
    },

    cloudinary: {
        cloud_name: "chicofirst",
        preset_name: "gxfxpq7n",
        api_key: "395873988196228"
    },

    cartoDB: {
        user: "chicofirst",
        filename: "creek_cleanup",
        api_key: "31afb49b10a48d726c7d1b1a41d45e395f29544d"
    }

}

    createMap(function() {
        createDropzone(function() {
            events();
        });
    });


function createMap(callback) {

    var basemaps = [], 
        basemapObjects = {}, 
        control, 
        bounds,
        ExtentControl;

    // Loads basemaps
    $.each(Config.basemaps, function(key, value) {
        basemaps[key] = L.tileLayer(value.url, {
            maxZoom: 20
        });
        basemaps[key].id = value.id;
    });

    // Initial Bounds
    bounds = L.latLngBounds(Config.map.bounds._northEast, Config.map.bounds._southWest);

    // Leaflet map
    map = L.map("map", {
        bounds: bounds,
        minZoom: 6,
        maxZoom: 19,
        zoom: 10,
        inertia: true,
        inertiaDeceleration: Config.map.inertia,
        attributionControl: false,
        layers: [basemaps[Config.basemapDefault]]
    });
    map.fitBounds(bounds);

    // Map scale (bottom left side of map)
    L.control.scale().addTo(map);

    // Creates location tool that will find user location
    L.control.locate({
        showPopup: false,
        strings: {
            title: "Show My Location"
        }
    }).addTo(map);

    // Loads basemaps into the Control Panel (top left of map)
    // Control Panel is not collapsed by default
    for (var v in basemaps) {
        basemapObjects[basemaps[v].id] = basemaps[v];
    }
    control = L.control.groupedLayers(basemapObjects).addTo(map);
    control.collapseUpdate(false);

    // Changes the look of the Radio buttons on the Control Panel
    $("input:checkbox, input:radio").uniform();

    // Extent button
    ExtentControl = L.Control.Button = L.Control.extend({
        options: {
            position: "topleft",
        },
        onAdd: function(map) {
            var container = L.DomUtil.create("div", "leaflet-control-button");
            container.style.background = "url(./assets/full-extent.png) #E5EBEA no-repeat center";
            container.style.backgroundSize = "20px 20px";
            container.style.border = "1px solid gray";
            container.style.cursor = "pointer";
            container.style.width = "30px";
            container.style.height = "30px";
            container.title = "Full Extent";
            container.onmouseover = function(){
                container.style.backgroundColor = "#DBD9DB";
            }
            container.onmouseout = function(){
                container.style.backgroundColor = "#E5EBEA";
            }
            container.onclick = function(){
                map.fitBounds(bounds);
            }
            return container;
        }
    });
    map.addControl(new ExtentControl);

    populateMap();

    callback();
}

function populateMap() {

    // Pulls data from CartoDB and pushes all found data into an array sorted by the cartodb_id
    var sql_statement = "SELECT cartodb_id, ST_AsGeoJSON(the_geom) AS the_geom, description, name FROM " + Config.cartoDB.filename;
    $.getJSON("https://" + Config.cartoDB.user + ".carto.com/api/v2/sql/?q=" + sql_statement + "&api_key=" + Config.cartoDB.api_key, function(d) {
        if (d.total_rows > 0) {
            $.each(d.rows, function(k, v) {
                array[v.cartodb_id] = [];
                array[v.cartodb_id].name = v.name;
                array[v.cartodb_id].description = v.description;

                // Creates map marker based on the returned geometry from CartoDB
                // Click function is also attached to each marker
                L.geoJson(JSON.parse(v.the_geom), {
                    pointToLayer: function (feature, latlng) {
                        array[v.cartodb_id].marker = L.marker(latlng, {
                            id: v.cartodb_id
                        }).addTo(map).on("click", getInfo);
                        return 0;
                    },
                });
            });

            // Pulls all images from Cloudinary
            // All images are sorted by cartodb_id and then by before and after tags
            // Images are stored in array
            $.getJSON("https://res.cloudinary.com/" + Config.cloudinary.cloud_name + "/image/list/creek.json", function(data) {
                var unique = [];
                $.each(data.resources, function(k, v) {
                    if (v.public_id !== "DO_NOT_REMOVE") {
                        var id = v.context.custom.cartodb_id,
                            image = "https://res.cloudinary.com/" + Config.cloudinary.cloud_name + "/image/upload/v" + v.version + "/" + v.public_id + ".png";
                        if (array[id] !== undefined) {
                            if (unique.indexOf(id) === -1) {
                                array[id].before = [];
                                array[id].after = [];
                                v.context.custom.type === "before" ? array[id].before.push(image) : array[id].after.push(image);
                                unique.push(id);
                            } else 
                                v.context.custom.type === "before" ? array[id].before.push(image) : array[id].after.push(image);
                        }
                    }
                });
            });
        }
    });

}

function createDropzone(callback) {

    Dropzone.autoDiscover = false;

    // Used to export all before images to the Cloudinary server
    dropzone_before = new Dropzone(".uploads_before", {
        url: "https://api.cloudinary.com/v1_1/" + Config.cloudinary.cloud_name + "/image/upload",                  
        autoProcessQueue: false,
        previewsContainer: ".dropzone_previews_before",
        uploadMultiple: false,
        parallelUploads: 6,
        maxFilesize: 10,
        thumbnailWidth: 80,
        thumbnailMethod: "contain",
        resizeWidth: 800,
        resizeMethod: "contain",
        acceptedFiles: "image/*"
    });
    $(".uploads_before span").html("Drop image or Click to upload<br>Click image to remove");

    // Used to export all after images to the Cloudinary server
    dropzone_after = new Dropzone(".uploads_after", {
        url: "https://api.cloudinary.com/v1_1/" + Config.cloudinary.cloud_name + "/image/upload",                  
        autoProcessQueue: false,
        previewsContainer: ".dropzone_previews_after",
        uploadMultiple: false,
        parallelUploads: 6,
        maxFilesize: 10,
        thumbnailWidth: 80,
        thumbnailMethod: "contain",
        resizeWidth: 800,
        resizeMethod: "contain",
        acceptedFiles: "image/*"
    });
    $(".uploads_after span").html("Drop image or Click to upload<br>Click image to remove");

    callback();

}

function events() {

    var holdNode = null;

    // Event is only shown when screen size is under 690px
    // Pushes all content to the side to reveal the map
    $(".show_map").click(function() {
        holdNode = $(this).parent();
        holdNode.hide();
        $(".hidden_container").show();
        $(".left_container").addClass("shrink");
        $("#map").addClass("map_show");
        map.invalidateSize();
    });

    // Event is only shown when screen size is under 690px
    // Hides the map and shows all other content
    $(".hidden_container").click(function() {
        $(this).hide();
        holdNode.show();
        $(".left_container").removeClass("shrink");
        $("#map").removeClass("map_show");
    });

    // Starts the process of create a new marker with data
    $(".create_new").click(function() {
        $(this).parent().hide();
        $(".create_point").show();
    });

    // Validates if marker is created if so shows Create Form
    $(".create_point input[value='NEXT']").click(function(e) {
        if (marker) {
            $(this).parent().parent().hide();
            $(".create_form").show();
            $(".create_form h2").html("CREATE LOCATION");
        } else {
            $(".validate_marker").show();
            setInterval(function(){$(".validate_marker").fadeOut();}, 2500);
        }
    });

    // Changes selected marker image back to default or removes marker if just created
    $(".create_point input[value='CANCEL']").click(function(e) {
        if (holdMarker != null)
            holdMarker._icon.src = "https://gicwebsrv.csuchico.edu/webmaps/apis/leaflet/images/marker-icon.png";
        $(this).parent().parent().hide();
        $(".default_container").show();
        if (marker)
            map.removeLayer(marker);
        marker = null;
        holdNode = null;
    });

    $(".point_data input[value='CLOSE']").click(function(e) {
        if (holdMarker != null)
            holdMarker._icon.src = "https://gicwebsrv.csuchico.edu/webmaps/apis/leaflet/images/marker-icon.png";
        $(this).parent().parent().hide();
        $(".default_container").show();
    });

    // Opens up the Create Form on existing marker with data for editing
    $(".edit_location").click(function() {
        $(this).parent().parent().hide();
        $(".create_form, .delete_location").show();
        $(".create_form h2").html("EDIT LOCATION");
        $("#name").val(array[carto_id].name);
        $("#description").val(array[carto_id].description);
    });

    // Event listener used for when the Select Location page is open
    map.on("click", function(e) {
        if (holdNode && holdNode.hasClass("create_point") || $(".create_point").is(":visible")) {
            if (marker)
                map.removeLayer(marker);
            marker = L.marker(e.latlng).addTo(map);
        }
    });

    // Saves text data to CartoDB and images to Cloudinary
    $("input[value='SUBMIT']").click(function(e) {
        e.preventDefault();
        if ($(".create_form").is(":visible")) {
            if ($(".create_form form #name").val()) {
                $(".process_content").show();

                // Builds SQL statement for CartoDB for exporting data
                if (marker)
                    var geo = "ST_SetSRID(ST_GeomFromGeoJSON('" + JSON.stringify(marker.toGeoJSON().geometry) + "'),4326)";
                else
                    var geo = "ST_SetSRID(ST_GeomFromGeoJSON('" + JSON.stringify(array[carto_id].marker.toGeoJSON().geometry) + "'),4326)";
                var title = $("#name").val(),
                    description = $("#description").val();
                if ($(".delete_location").is(":visible"))
                    sql_statement = "UPDATE " + Config.cartoDB.filename + " SET the_geom=" + geo + ", description='" + description + "', name='" + title + "' WHERE cartodb_id=" + carto_id;
                else
                    sql_statement = "INSERT INTO " + Config.cartoDB.filename + " (the_geom, description, name) VALUES (" + geo + ",'" + description + "','" + title + "')";

                // Sends point geometry and data to CartoDB and returns unique ID after upload
                $.getJSON("https://" + Config.cartoDB.user + ".carto.com/api/v2/sql/?q=" + sql_statement + "&api_key=" + Config.cartoDB.api_key, function(d, s) {

                    // .delete_location visibility is used to check if this is an existing location being edited
                    if ($(".delete_location").is(":visible")) {
                        array[carto_id].name = title;
                        array[carto_id].description = description;

                        // Starts Image upload process
                        dropzone_before.processQueue();
                        dropzone_after.processQueue();

                        $(".process_content, .create_form").hide();
                        $(".point_data .location").html(title);
                        $(".point_data .description").html(description);
                        $(".create_form form #name").val("");
                        $(".create_form form textarea").val("");
                        if (holdMarker != null)
                            holdMarker._icon.src = "https://gicwebsrv.csuchico.edu/webmaps/apis/leaflet/images/marker-icon.png";
                        $(".default_container").show();
                    } else {
                        // After NEW location is created another JSON request is sent to CartoDB to get the new info
                        $.getJSON("https://" + Config.cartoDB.user + ".carto.com/api/v2/sql/?q=SELECT cartodb_id FROM " + Config.cartoDB.filename + " ORDER BY cartodb_id DESC LIMIT 1&api_key=" + Config.cartoDB.api_key, function(data, success) {
                            
                            carto_id = data.rows[0].cartodb_id;
                            array[carto_id] = [];
                            array[carto_id].before = [];
                            array[carto_id].after = [];
                            array[carto_id].name = title;
                            array[carto_id].description = description;
                            array[carto_id].marker = L.marker(marker._latlng, {
                                id: data.rows[0].cartodb_id
                            }).addTo(map).on("click", getInfo);

                            map.removeLayer(marker);

                            // Starts Image upload process
                            dropzone_before.processQueue();
                            dropzone_after.processQueue();

                            $(".process_content, .create_form").hide();
                            $(".default_container").show();
                            $(".create_form form #name").val("");
                            $(".create_form form textarea").val("");
                        });
                    }
                });
            } else {
                $(".validate_location").show();
                setInterval(function(){$(".validate_location").fadeOut();}, 4000);
            }
        } else {
            dropzone_before.processQueue();
            dropzone_after.processQueue();
        }

    });
    
    // Resets all inputs and removes all unsaved images from Dropzone
    $(".create_form input[value='BACK']").click(function(e) {
        $(".create_form form #name").val("");
        $(".create_form form textarea").val("");  
        dropzone_before.removeAllFiles();
        dropzone_after.removeAllFiles();
        
        if ($(".delete_location").is(":visible")) {
            $(this).parent().parent().parent().hide();
            $(".point_data").show();
        } else {
            $(this).parent().parent().parent().hide();
            $(".create_point").show();
        }

    });

    $("dialog .close").click(function() {
        $("dialog").addClass("hide");
    });

    // Sends request to CartoDB to delete point geometry and data of selected marker
    // Images are NOT removed from Cloudinary (no easy way to do this with javascript)
    $(".delete_location").click(function() {
        $.getJSON("https://" + Config.cartoDB.user + ".carto.com/api/v2/sql/?q=DELETE FROM " + Config.cartoDB.filename + " WHERE cartodb_id=" + carto_id + "&api_key=" + Config.cartoDB.api_key, function(d, s) {
            if (marker)
                map.removeLayer(marker);
            if (holdMarker != null)
                map.removeLayer(holdMarker);
            $(".default_container").show();
        })
    });

    // Adds event listeners to each images put into dropzone before area
    // On click the image is removed
    dropzone_before.on("addedfile", function(file) {
        file.previewElement.addEventListener("click", function() {
            dropzone_before.removeFile(file);
        });
    });

    // Adds event listeners to each images put into dropzone after area
    // On click the image is removed
    dropzone_after.on("addedfile", function(file) {
        file.previewElement.addEventListener("click", function() {
            dropzone_after.removeFile(file);
        });
    });

    dropzone_before.on("sending", function(file, xhr, formData) {
        editData(formData, "before");
    });

    dropzone_after.on("sending", function(file, xhr, formData) {
        editData(formData, "after");
    });

    // formData is necessary for uploading to Cloudinary using Dropzone
    // context is used to store and link the CartoDB ID to the images and Data
    // tags ["creek"] is used for the retrieval of images on page load
    // Preset Name is used for uploading unsigned images to Cloudinary
    function editData(formData, type) {
        formData.append("context", "type=" + type + "|cartodb_id=" + carto_id);
        formData.append("tags", ["creek"]);
        formData.append("api_key", Config.cloudinary.api_key);
        formData.append("timestamp", Date.now() / 1000 | 0);
        formData.append("upload_preset", Config.cloudinary.preset_name);
    }

    // After upload the response returns a secured URL
    // This URL is used to display the images after upload
    dropzone_before.on("success", function (file, response) {
        console.log("Success! Cloudinary public ID is ", response.public_id);
        array[carto_id].before.push(response.secure_url);
    });

    // After upload the response returns a secured URL
    // This URL is used to display the images after upload
    dropzone_after.on("success", function (file, response) {
        console.log("Success! Cloudinary public ID is ", response.public_id);
        array[carto_id].after.push(response.secure_url);
    });

    dropzone_before.on("queuecomplete", function () {
        dropzone_before.removeAllFiles();
    });

    dropzone_after.on("queuecomplete", function () {
        dropzone_after.removeAllFiles();
    });

    dropzone_before.on("error", function (file, response) {
        console.log("Error: ", response.public_id);
    });

    dropzone_after.on("error", function (file, response) {
        console.log("Error: ", response.public_id);
    });

}

// Used to pull data from the array of data that was build on load
// Data is then displayed and the map marker is changed
function getInfo() {

    carto_id = this.options.id;
    var node = array[carto_id];

    clearInfo();
    $(".left_container").removeClass("shrink");
    $("#map").removeClass("map_show");
    $(".left_container > div").hide();
    $(".point_data").show();

    this._icon.src = "https://gicwebsrv.csuchico.edu/webmaps/apis/leaflet/images/marker-icon-green.png";
    holdMarker = this;

    $(".point_data .location").html(node.name);

    if (node.description !== "")
        $(".point_data .description").html(node.description);
    else {
        $(".point_data .description").hide();
        $(".point_data .description").prev().hide();
    }

    if (node.hasOwnProperty('before') && node.before.length > 0) {
        $(".img_container_before, .img_before").show();
        for (key in node.before) {
            $(".img_container_before").append("<img src='" + node.before[key] + "'>");
        }
        $(".img_container_before img").click(function() {
            var img = $(this).clone();
            $(".dialog_img").html("");
            $(".dialog_img").append(img).parent().parent().removeClass("hide");
            $("dialog > div").css("width", $(this)[0].naturalWidth + 64);
        });
    } 

    if (node.hasOwnProperty('after') && node.after.length > 0) {
        $(".img_container_after, .img_after").show();
        for (key in node.after) {
            $(".img_container_after").append("<img src='" + node.after[key] + "'>");
        }
        $(".img_container_after img").click(function() {
            var img = $(this).clone();
            $(".dialog_img").html("");
            $(".dialog_img").append(img).parent().parent().removeClass("hide");
            $("dialog > div").css("width", $(this)[0].naturalWidth + 64);
        });
    }

}

var test;

function clearInfo() {
    if (holdMarker != null && holdMarker._icon != null){
        holdMarker._icon.src = "https://gicwebsrv.csuchico.edu/webmaps/apis/leaflet/images/marker-icon.png";
    }
    $(".point_data .location").html("");
    $(".point_data .description").html("");
    $(".img_container_before, .img_container_after").empty();
}