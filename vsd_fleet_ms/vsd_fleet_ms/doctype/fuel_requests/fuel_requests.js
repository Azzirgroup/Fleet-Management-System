// Copyright (c) 2023, VV SYSTEMS DEVELOPER LTD and contributors
// For license information, please see license.txt

frappe.ui.form.on('Fuel Requests', {
    refresh: function (frm, cdt, cdn) {
        // Update status based on requested and approved fuel
        if (frm.doc.requested_fuel.length > 0 && frm.doc.approved_requests.length < 1 && frm.doc.status != "Waiting Approval") {
            frappe.db.set_value(frm.doc.doctype, frm.doc.name, "status", "Waiting Approval");
        }
        if (frm.doc.requested_fuel.length > 0 && frm.doc.approved_requests.length > 0 && frm.doc.status != "Partially Processed") {
            frappe.db.set_value(frm.doc.doctype, frm.doc.name, "status", "Partially Processed");
        }
        if (frm.doc.requested_fuel.length < 1 && frm.doc.approved_requests.length > 0 && frm.doc.status != "Fully Processed") {
            frappe.db.set_value(frm.doc.doctype, frm.doc.name, "status", "Fully Processed");
        }

        frm.events.show_hide_sections(frm);

        // Hide delete buttons for Requested fuel Child Doctype
        $('*[data-fieldname="requested_fuel"]').find('.grid-remove-rows').hide();
        $('*[data-fieldname="requested_fuel"]').find('.grid-remove-all-rows').hide();
        $('*[data-fieldname="requested_fuel"]').find('.grid-add-row').hide();
        $('*[data-fieldname="approved_requests"]').find('.btn[data-fieldname="create_purchase_order"]').hide();

        // Add custom buttons for Approve and Reject
        if (frm.doc.requested_fuel.length > 0) {
            frm.add_custom_button(__('Approve'), function () {
                frm.events.approve_selected_requests(frm);
            }, __('Actions'));

            frm.add_custom_button(__('Reject'), function () {
                frm.events.reject_selected_requests(frm);
            }, __('Actions'));
        }

        // Commented out Purchase Order and Stock Entry buttons
        // if (frm.doc.status === "Fully Processed") {
        //     frappe.msgprint(locals[cdt][cdn].status);
        //     var row = frm.fields_dict['approved_requests'].grid.grid_rows_by_docname[cdn];
        //
        //     if (row.doc.status == "Approved") {
        //         frm.add_custom_button(__('Purchase Order'), function () {
        //             frm.events.make_purchase_order(frm);
        //         }, __("Make"));
        //         frm.add_custom_button(__('Issue Fuel'), function () {
        //             frm.events.make_stock_entry(frm);
        //         }, __("Make"));
        //     }
        // }
    },

    show_hide_sections: function (frm) {
        frm.toggle_display(['section_requested_fuel'], (frm.doc.requested_fuel.length > 0));
    },

    show_hide_request_fields: function (frm, cdt, cdn) {
        var row = frm.fields_dict['approved_requests'].grid.grid_rows_by_docname[cdn];
        if (row.doc.status == "Approved") {
            row.toggle_editable('disburcement_type', (row.doc.receipt_date == null));
            row.toggle_editable('supplier', (row.doc.receipt_date == null && row.doc.disburcement_type == "From Supplier"));
            row.toggle_editable('receipt_date', ((row.doc.disburcement_type == "From Supplier" && row.doc.supplier) || (row.doc.disburcement_type == "Cash")));
            row.toggle_editable('receipt_time', ((row.doc.disburcement_type == "From Supplier" && row.doc.supplier) || (row.doc.disburcement_type == "Cash")));
        }
    },

    approve_selected_requests: function (frm) {
        var selected = frm.get_selected();
        if (selected['requested_fuel']) {
            frappe.confirm(
                'Confirm: Approve selected requests?',
                function () {
                    selected['requested_fuel'].forEach(function (value) {
                        frappe.call({
                            method: "vsd_fleet_ms.vsd_fleet_ms.doctype.fuel_requests.fuel_requests.approve_request",
                            freeze: true,
                            args: {
                                request_doctype: "Fuel Requests Table",
                                request_docname: value,
                                user: frappe.user.full_name()
                            },
                            callback: function (data) {
                                //alert(JSON.stringify(data));
                            }
                        });
                    });
                    frappe.call({
                        method: "vsd_fleet_ms.vsd_fleet_ms.doctype.fuel_requests.fuel_requests.set_status",
                        freeze: true,
                        args: {
                            request_doctype: "Fuel Requests Table",
                        },
                        callback: function (data) {
                            //alert(JSON.stringify(data));
                            frm.reload_doc();
                        }
                    });
                },
                function () {
                    // Do nothing
                }
            );
        } else {
            frappe.show_alert("Error: Please select requests to process.");
        }
    },

    reject_selected_requests: function (frm) {
        var selected = frm.get_selected();
        if (selected['requested_fuel']) {
            frappe.confirm(
                'Confirm: Reject selected requests?',
                function () {
                    selected['requested_fuel'].forEach(function (value) {
                        frappe.call({
                            method: "vsd_fleet_ms.vsd_fleet_ms.doctype.fuel_requests.fuel_requests.reject_request",
                            freeze: true,
                            args: {
                                request_doctype: "Fuel Requests Table",
                                request_docname: value,
                                user: frappe.user.full_name()
                            },
                            callback: function (data) {
                                //alert(JSON.stringify(data));
                            }
                        });
                    });
                    frappe.call({
                        method: "vsd_fleet_ms.vsd_fleet_ms.doctype.fuel_requests.fuel_requests.set_status",
                        freeze: true,
                        args: {
                            request_doctype: "Fuel Requests Table",
                        },
                        callback: function (data) {
                            //alert(JSON.stringify(data));
                            frm.reload_doc();
                        }
                    });
                },
                function () {
                    // Do nothing
                }
            );
        } else {
            frappe.show_alert("Error: Please select requests to process.");
        }
    },

    make_purchase_order: function (frm) {
        frappe.model.open_mapped_doc({
            method: "vsd_fleet_ms.vsd_fleet_ms.doctype.fuel_requests.fuel_requests.make_purchase_order",
            frm: frm
        });
    },

    make_stock_entry: function (frm) {
        frappe.model.open_mapped_doc({
            method: "vsd_fleet_ms.vsd_fleet_ms.doctype.fuel_requests.fuel_requests.make_stock_entry",
            frm: frm
        });
    },
});


frappe.ui.form.on('Fuel Requests Table', {

    form_render(frm, cdt, cdn) {
        frm.fields_dict.approved_requests.grid.wrapper.find('.btn[data-fieldname="create_purchase_order"]').hide();
        frm.fields_dict.requested_fuel.grid.wrapper.find('.grid-delete-row').hide();
        frm.fields_dict.requested_fuel.grid.wrapper.find('.grid-duplicate-row').hide();
        frm.fields_dict.requested_fuel.grid.wrapper.find('.grid-move-row').hide();
        frm.fields_dict.requested_fuel.grid.wrapper.find('.grid-append-row').hide();
        frm.fields_dict.requested_fuel.grid.wrapper.find('.grid-insert-row-below').hide();
        frm.fields_dict.requested_fuel.grid.wrapper.find('.grid-insert-row').hide();
    }
});
