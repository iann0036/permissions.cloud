// permissions.cloud Core Functionality

function arnReplace(arn, action, resource_mapping_sub, resource_type_name) {
    if (action['resource_mappings'] && resource_mapping_sub) {
        if (resource_type_name && action['resourcearn_mappings']) {
            for (var resourcearn_mapping_name of Object.keys(action['resourcearn_mappings'])) {
                arn = '<a class="tx-semibold" href="#" data-toggle="modal" data-target="#resourceTypeModal">' + templateReplace(action['resourcearn_mappings'][resourcearn_mapping_name], action, false) + '</a>';
            }
        }

        for (var resource_mapping_name of Object.keys(action['resource_mappings'])) {
            arn = arn.replace(new RegExp('\\$\\{(' + resource_mapping_name + ')\\}', 'g'), '<a class="tx-semibold tx-pink" href="#" data-toggle="modal" data-target="#resourceTypeModal">' + templateReplace(action['resource_mappings'][resource_mapping_name]['template'], action, false) + '</a>');
        }
    }

    arn = arn.replace(/\$\{(Partition)\}/g, '<span class="tx-semibold tx-gray-500">aws</span>');
    arn = arn.replace(/\$\{(Region)\}/g, '<span class="tx-semibold tx-gray-500">us-east-1</span>');
    arn = arn.replace(/\$\{(Account)\}/g, '<span class="tx-semibold tx-gray-500">123456789012</span>');
    
    arn = arn.replace(/\$\{(.+?)\}/g, '<a class="tx-semibold" href="#" data-toggle="modal" data-target="#resourceTypeModal">$1</a>');
    //arn = arn.replace(/\$\{(.+?)\}/g, '<span class="tx-semibold">$1</span>');

    return arn;
}

function templateReplace(arn, action, resource_mapping_sub) {
    if (arn.includes("%%iftruthy%")) {
        let arn_parts = arn.split("%");
        let else_ext = '';
        if (arn_parts[5] != "") {
            else_ext = ' <span class="badge badge-info">otherwise</span> ' + arnReplace(arn_parts[5], action, resource_mapping_sub, null);
        }

        return arnReplace(arn_parts[0], action, resource_mapping_sub, null) + '<span class="badge badge-info">if truthy</span> ' + arnReplace(arn_parts[3], action, resource_mapping_sub, null) + ' <span class="badge badge-info">then</span> ' + arnReplace(arn_parts[4], action, resource_mapping_sub, null) + else_ext;
    } else if (arn.includes("%%many%")) {
        let arn_parts = arn.split("%");
        let many_instances = [];
        for (let i=3; i<arn_parts.length-2; i++) {
            many_instances.push(arnReplace(arn_parts[i], action, resource_mapping_sub, null));
        }

        many_instances = [...new Set(many_instances)]; // dedupe

        return arnReplace(arn_parts[0], action, resource_mapping_sub, null) + many_instances.join("<br />");
    } else if (arn.includes("%%urlencode%")) {
        let arn_parts = arn.split("%");

        return arnReplace(arn_parts[0], action, resource_mapping_sub, null) + '<span class="badge badge-info">urlencode</span> ' + arnReplace(arn_parts[3], action, resource_mapping_sub, null);
    } else if (arn.includes("%%iftemplatematch%")) {
        let arn_parts = arn.split("%");

        return arnReplace(arn_parts[0], action, resource_mapping_sub, null) + '<span class="badge badge-info">if ARN matches format</span> ' + arnReplace(arn_parts[3], action, resource_mapping_sub, null);
    } else if (arn.includes("%%regex%")) {
        let arn_parts = arn.split("%");

        return arnReplace(arn_parts[0], action, resource_mapping_sub, null) + '<span class="badge badge-info">for the property</span> ' + arnReplace(arn_parts[3], action, resource_mapping_sub, null) + ' <span class="badge badge-info">get first match of the regex pattern</span> ' + arn_parts[4];
    }

    return arnReplace(arn, action, resource_mapping_sub, null);
}

async function getTemplates(action, iam_def) {
    let action_parts = action['action'].split(":");
    let ret = '*';
    let templates = [];

    if (action['arn_override']) {
        templates.push(templateReplace(action['arn_override']['template'], action, true) + ' <span class="badge badge-dark">overriden</span>');
    } else {
        for (let service_def of iam_def) {
            if (service_def['prefix'] == action_parts[0]) {
                for (let privilege of service_def['privileges']) {
                    if (privilege['privilege'] == action_parts[1]) {
                        for (let resource_type of privilege['resource_types']) {
                            if (resource_type['resource_type'] != "") {
                                resource_type_name = resource_type['resource_type'].replace("*", "");
                                for (let resource of service_def['resources']) {
                                    if (resource['resource'] == resource_type_name) {
                                        let arn = arnReplace(resource['arn'], action, true, resource_type_name);

                                        templates.push(arn);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (templates.length) {
        templates = [...new Set(templates)]; // dedupe
        ret = templates.join("<br />");
    }

    return ret;
}

async function getUsedBy(privilege, sdk_map) {
    let used_by_methods = [];

    for (let iam_mapping_name of Object.keys(sdk_map['sdk_method_iam_mappings']).sort()) {
        for (let action of sdk_map['sdk_method_iam_mappings'][iam_mapping_name]) {
            if (action['action'] == privilege) {
                used_by_methods.push(iam_mapping_name);
            }
        }
    }

    if (used_by_methods.length) {
        used_by_methods.sort();

        return used_by_methods.join("<br />");
    }

    return '-';
}

async function processReferencePage() {
    let iam_def_data = await fetch('https://iann0036.github.io/sdk-iam-map/js/iam_definition.json');
    let iam_def = await iam_def_data.json();
    let service = iam_def[0];

    let sdk_map_data = await fetch('https://iann0036.github.io/sdk-iam-map/map.json');
    let sdk_map = await sdk_map_data.json();

    $('#actions-table tbody').html('');
    
    if ($('#reference-list').html() == "") {
        for (let service_def of iam_def) {
            if (window.location.pathname == "/iam/" + service_def['prefix']) {
                service = service_def;

                $('#reference-list').append('<li class="nav-item active"><a href="/iam/' + service_def['prefix'] + '" class="nav-link"><span>' + service_def['service_name'] + '</span></a></li>');
            } else if (window.location.pathname == "/api/" + service_def['prefix']) {
                service = service_def;

                $('#reference-list').append('<li class="nav-item active"><a href="/api/' + service_def['prefix'] + '" class="nav-link"><span>' + service_def['service_name'] + '</span></a></li>');
            } else if (window.location.pathname.startsWith("/api/")) {
                $('#reference-list').append('<li class="nav-item"><a href="/api/' + service_def['prefix'] + '" class="nav-link"><span>' + service_def['service_name'] + '</span></a></li>');
            } else {
                $('#reference-list').append('<li class="nav-item"><a href="/iam/' + service_def['prefix'] + '" class="nav-link"><span>' + service_def['service_name'] + '</span></a></li>');
            }
        }
    }

    $('#body-dashboard').attr('style', 'display: none;');
    $('#body-usage').attr('style', 'display: none;');
    $('#body-tooling').attr('style', 'display: none;');
    $('#body-permissions').attr('style', 'display: none;');
    if (window.location.pathname == "/") {
        $('#nav-general-dashboard').addClass('active');
        $('#body-dashboard').attr('style', '');
    } else if (window.location.pathname.startsWith("/usage")) {
        $('#nav-general-usage').addClass('active');
        $('#body-usage').attr('style', '');
    } else if (window.location.pathname.startsWith("/tooling")) {
        $('#nav-general-tooling').addClass('active');
        $('#body-tooling').attr('style', '');
    } else if (window.location.pathname.startsWith("/iam") || window.location.pathname.startsWith("/api")) {
        $('#body-permissions').attr('style', '');
    } else {
        // TODO
    }

    if (window.location.pathname.startsWith("/iam/")) {
        $('.display-iam').attr('style', '');
        $('.display-api').attr('style', 'display: none;');
    } else if (window.location.pathname.startsWith("/api/")) {
        $('.display-iam').attr('style', 'display: none;');
        $('.display-api').attr('style', '');
    }

    $('.servicename').html(service['service_name']);
    $('#iam-count').html(service['privileges'].length);

    $('.iam-link').click(() => {
        window.location.pathname = window.location.pathname.replace("/api/", "/iam/");
    });
    $('.api-link').click(() => {
        window.location.pathname = window.location.pathname.replace("/iam/", "/api/");
    });

    let actions_table_content = '';
    for (let privilege of service['privileges']) {
        let first_resource_type = privilege['resource_types'].shift();

        let condition_keys = [];
        for (let condition_key of first_resource_type['condition_keys']) {
            condition_keys.push('<a href="#">' + condition_key + '</a>');
        }

        let rowspan = privilege['resource_types'].length + 1;
        let access_class = "tx-success";
        if (["Write", "Permissions management"].includes(privilege['access_level'])) {
            access_class = "tx-pink";
        }

        let used_by = await getUsedBy(service['prefix'] + ':' + privilege['privilege'], sdk_map);
        
        actions_table_content += '<tr>\
            <td rowspan="' + rowspan + '" class="tx-medium"><span class="tx-color-03">' + service['prefix'] + ':</span>' + privilege['privilege'] + '</td>\
            <td rowspan="' + rowspan + '" class="tx-normal">' + privilege['description'] + '</td>\
            <td rowspan="' + rowspan + '" class="tx-normal">' + used_by + '</td>\
            <td rowspan="' + rowspan + '" class="' + access_class + '">' + privilege['access_level'] + '</td>\
            <td class="tx-normal">' + first_resource_type['resource_type'] + '</td>\
            <td class="tx-medium">' + condition_keys.join("<br />") + '</td>\
        </tr>';

        for (let resource_type of privilege['resource_types']) {
            let condition_keys = [];
            for (let condition_key of resource_type['condition_keys']) {
                condition_keys.push('<a href="#">' + condition_key + '</a>');
            }

            actions_table_content += '<tr>\
                <td class="tx-normal" style="padding-left: 10px !important;">' + resource_type['resource_type'] + '</td>\
                <td class="tx-medium">' + condition_keys.join("<br />") + '</td>\
            </tr>';
        }
    }
    $('#actions-table tbody').append(actions_table_content);

    // get primary
    let api_prefixes = [];
    for (let iam_mapping_name of Object.keys(sdk_map['sdk_method_iam_mappings']).sort()) {
        let first_action = sdk_map['sdk_method_iam_mappings'][iam_mapping_name][0];

        if (first_action['action'].split(":")[0] == service['prefix']) { // TODO: better matching
            api_prefixes.push(iam_mapping_name.split(".")[0]);
        }
    }

    let method_table_content = '';
    let api_count = 0;
    for (let iam_mapping_name of Object.keys(sdk_map['sdk_method_iam_mappings']).sort()) {
        let iam_mapping_name_parts = iam_mapping_name.split(".");
        if (api_prefixes.includes(iam_mapping_name_parts[0])) {
            let first_action = sdk_map['sdk_method_iam_mappings'][iam_mapping_name].shift();

            let rowspan = sdk_map['sdk_method_iam_mappings'][iam_mapping_name].length + 1;

            let actionlink = "/iam/" + first_action['action'].split(":")[0];
            let template = await getTemplates(first_action, iam_def);
            let undocumented = '';
            if (first_action['undocumented']) {
                undocumented = ' <span class="badge badge-danger">undocumented</span>';
            }

            method_table_content += '<tr>\
                <td rowspan="' + rowspan + '" class="tx-medium"><span class="tx-color-03">' + iam_mapping_name_parts[0] + '.</span>' + iam_mapping_name_parts[1] + '</td>\
                <td rowspan="' + rowspan + '" class="tx-normal">' + '-' + '</td>\
                <td class="tx-medium"><a href="' + actionlink + '">' + first_action['action'] + undocumented + '</a></td>\
                <td class="tx-medium">' + template + '</td>\
            </tr>';

            for (let action of sdk_map['sdk_method_iam_mappings'][iam_mapping_name]) {
                let actionlink = "/iam/" + action['action'].split(":")[0];
                let template = await getTemplates(action, iam_def);
                let undocumented = '';
                if (action['undocumented']) {
                    undocumented = ' <span class="badge badge-danger">undocumented</span>';
                }

                method_table_content += '<tr>\
                    <td class="tx-medium" style="padding-left: 10px !important;"><a href="' + actionlink + '">' + action['action'] + undocumented + '</a></td>\
                    <td class="tx-medium">' + template + '</td>\
                </tr>';
            }

            api_count += 1;
        }
    }

    $('#api-count').html(api_count.toString());
    $('#methods-table tbody').append(method_table_content);
}

processReferencePage();
