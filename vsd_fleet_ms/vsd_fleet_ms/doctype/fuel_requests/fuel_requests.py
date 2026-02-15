# Copyright (c) 2023, VV SYSTEMS DEVELOPER LTD and contributors
# For license information, please see license.txt

import json
import frappe
from frappe.model.document import Document
from frappe import _, msgprint
from frappe.model.mapper import get_mapped_doc
from frappe.utils import nowdate, now

class FuelRequests(Document):
    def onload(self):
        if self.reference_doctype and self.reference_docname:
            trip = frappe.get_doc(self.reference_doctype, self.reference_docname)
            if not self.main_route:
                self.set("main_route", trip.route)
            if not self.truck:
                self.set("truck", trip.truck_number)
            if not self.truck_driver:
                self.set("truck_driver", trip.assigned_driver)
            if not self.driver_name:
                self.set("driver_name", trip.driver_name)

        # Load virtual child tables from reference document
        self._load_virtual_children()

    def _load_virtual_children(self):
        """Load child table data from the reference document's fuel request history."""
        if not self.get("reference_docname") or not self.get("reference_doctype"):
            return

        ref_docname = self.get("reference_docname")
        ref_doctype = self.get("reference_doctype")

        # Get the child table DocType from meta
        table_fields = {df.fieldname: df for df in self.meta.get_table_fields()}

        if "approved_requests" in table_fields:
            df = table_fields["approved_requests"]
            children = frappe.db.get_values(
                df.options,
                {
                    "parent": ref_docname,
                    "parenttype": ref_doctype,
                    "parentfield": ["in", ("fuel_request_history", "return_fuel_request")],
                    "status": ["in", ("Approved", "Rejected")],
                },
                "*",
                as_dict=True,
                order_by="idx asc",
            )
            self.set("approved_requests", children or [])

        if "requested_fuel" in table_fields:
            df = table_fields["requested_fuel"]
            children = frappe.db.get_values(
                df.options,
                {
                    "parent": ref_docname,
                    "parenttype": ref_doctype,
                    "parentfield": ["in", ("fuel_request_history", "return_fuel_request")],
                    "status": "Requested",
                },
                "*",
                as_dict=True,
                order_by="idx asc",
            )
            self.set("requested_fuel", children or [])

    def get_all_children(self, parenttype=None):
        # For getting children
        return []

    def update_children(self):
        """update child tables"""

    def before_save(self):
        for row in self.approved_requests:
            doc = frappe.get_doc("Fuel Requests Table", row.name)
            doc.db_set("disbursement_type", row.disbursement_type)
            doc.db_set("supplier", row.supplier)
            doc.db_set("receipt_date", row.receipt_date)
            doc.db_set("receipt_time", row.receipt_time)
            doc.db_set("received_by", row.received_by)

@frappe.whitelist()
def set_status(doc):
    parent_doc_name = frappe.db.get_value("Fuel Requests Table", doc, "parent")
    fuel_requests = frappe.db.sql(
        """SELECT name, status FROM `tabFuel Requests Table` WHERE parent = %(parent_name)s""",
        {"parent_name": parent_doc_name},
        as_dict=1,
    )

    processed_requests = 0
    status = "Fully Processed"

    for request in fuel_requests:
        if request.status not in ["Approved", "Rejected"]:
            status = "Partially Processed"
        else:
            processed_requests = processed_requests + 1

    parent_request_name = frappe.db.get_value(
        "Fuel Request", {"reference_docname": parent_doc_name}
    )
    parent_request_doc = frappe.get_doc("Fuel Requests", parent_request_name)
    if 0 == processed_requests:
        parent_request_doc.db_set("status", "Waiting Approval")
    else:
        parent_request_doc.db_set("status", status)


@frappe.whitelist()
def approve_request(**args):
    args = frappe._dict(args)
    timestamp = now()

    doc = frappe.get_doc("Fuel Requests Table", args.request_docname)
    doc.db_set("status", "Approved")
    doc.db_set("approved_by", args.user)
    doc.db_set("approved_date", timestamp)
    # set_status(args.request_docname)
    return "Request Updated"


@frappe.whitelist()
def reject_request(**args):
    args = frappe._dict(args)
    timestamp = now()

    doc = frappe.get_doc("Fuel Requests Table", args.request_docname)
    doc.db_set("status", "Rejected")
    doc.db_set("approved_by", args.user)
    doc.db_set("approved_date", timestamp)
    # set_status(args.request_docname)
    return "Request Updated"

@frappe.whitelist()
def make_stock_entry(source_name, target_doc=None):
    doc = get_mapped_doc(
        "Fuel Requests",
        source_name,
        {
            "Fuel Requests": {
                "doctype": "Stock Entry",
                "field_map": {},
                "validation": {
                    "docstatus": ["=", 0],
                },
            },
            "Fuel Requests Table": {
                "doctype": "Stock Entry Detail",
                "field_map": {
                    "name": "fuel_request_table",
                    "parent": "fuel_request",
                    # "total_cost": "basic_amount",
                    "quantity": "qty",
                    source_name: "fuel_request",
                    # "cost_per_litre": "basic_rate",
                },
            },
        },
        target_doc,
    )
    return doc

