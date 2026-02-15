// Copyright (c) 2023, VV SYSTEMS DEVELOPER LTD and contributors
// For license information, please see license.txt

frappe.ui.form.on('Requested Payment', {
	onload: function(frm){
		// Buttons will be added in refresh event
		frappe.after_ajax(function(){
			frm.events.show_hide_sections(frm);
		});
	},

	setup: function(frm){
		$(frm.wrapper).on("grid-row-render", function(e, grid_row) {
			if (grid_row.doc.request_status == "Requested") {
				$(grid_row.columns.request_status).css({"font-weight": "bold","color": "blue"});
			}
			else if(grid_row.doc.request_status == "Approved")
			{
				$(grid_row.columns.request_status).css({"font-weight": "bold", "color": "green"});
			}
			else if(grid_row.doc.request_status == "Rejected")
			{
				$(grid_row.columns.request_status).css({"font-weight": "bold", "color": "red"});
			}
		});
	},

	refresh: function(frm){
		// Hide disburse funds button
		var disburseFundsButton = frm.fields_dict['accounts_approval'];
		disburseFundsButton.$wrapper.find('[data-fieldname="disburse_funds"]').hide();
		$('*[data-fieldname="requested_funds"]').find('.grid-remove-rows').hide();
		$('*[data-fieldname="requested_funds"]').find('.grid-remove-all-rows').hide();
		$('*[data-fieldname="requested_funds"]').find('.grid-add-row').hide();

		frappe.after_ajax(function(){
			frm.events.show_hide_sections(frm);
		});

		// Add Approve and Reject buttons for requested_funds section
		if(frm.doc.requested_funds && frm.doc.requested_funds.length > 0){
			frm.add_custom_button(__('Approve'), function() {
				frm.events.approve_request(frm);
			}, __('Actions'));

			frm.add_custom_button(__('Reject'), function() {
				frm.events.reject_request(frm);
			}, __('Actions'));
		}

		// For total requested
		var total_request_tsh = 0;
		var total_request_usd = 0;
		frm.doc.requested_funds.forEach(function(row){
			if(row.request_currency == 'TZS')
			{
				total_request_tsh += row.request_amount;
			}
			else if(row.request_currency == 'USD')
			{
				total_request_usd += row.request_amount;
			}
		});

		// If all requests have been processed, change approval status
		if(total_request_tsh == 0 && total_request_usd == 0 && frm.doc.approval_status != "Processed")
		{
			frm.set_value('approval_status', 'Processed');
			frm.save_or_update();
		}

		frm.get_field("request_total_amount").$wrapper.html('<p class="text-muted small">Total Amount Approved</p><b>USD ' + total_request_usd.toLocaleString() + ' <br> TZS ' + total_request_tsh.toLocaleString() + '</b>');


		if (frm.doc.requested_funds.length > 0){
			frm.set_value('payment_status', 'Waiting Approval');
			frm.save_or_update();
		} else{
			// For total approved
			var total_approved_tsh = 0;
			var total_approved_usd = 0;
			frm.doc.accounts_approval.forEach(function(row){
				if(row.request_status == "Approved" && row.request_currency == 'TZS' && row.journal_entry != '')
				{
					total_approved_tsh += row.request_amount;
				}
				else if(row.request_status == "Approved" && row.request_currency == 'USD' && row.journal_entry != '')
				{
					total_approved_usd += row.request_amount;
				}
			});

			frm.get_field("total_amount").$wrapper.html('<p class="text-muted small">Total Amount Approved</p><b>USD ' + total_approved_usd.toLocaleString() + ' <br> TZS ' + total_approved_tsh.toLocaleString() + '</b>');

			// For total paid amount
			var total_tsh = 0;
			var total_usd = 0;
			frm.doc.accounts_approval.forEach(function(row){
				if(row.request_currency == "TZS")
				{
					total_tsh += row.request_amount;
				}
				else if(row.request_currency == 'USD')
				{
					total_usd += row.request_amount;
				}
			});

			var total_paid_tsh = 0;
			var total_paid_usd = 0;
			frm.doc.accounts_approval.forEach(function(row){
				if(row.request_status == "Approved" && row.request_currency == 'TZS' && row.journal_entry)
				{
					total_paid_tsh += row.request_amount;
				}
				else if(row.request_status == "Approved" && row.request_currency == 'USD' && row.journal_entry)
				{
					total_paid_usd += row.request_amount;
				}
			});

			// For payment status (If all payments have been paid, payment status == 'Paid')
			if(total_usd >= 0 && total_tsh >= 0 && total_usd == total_paid_usd && total_tsh == total_paid_tsh && frm.doc.payment_status != "Paid")
			{
				frm.set_value('payment_status', "Paid");
				frm.save_or_update();
			}
			else if((total_paid_tsh < total_tsh || total_paid_usd < total_usd) && frm.doc.payment_status != "Waiting Payment")
			{
				frm.set_value('payment_status', 'Waiting Payment');
				frm.save_or_update();
			}

			frm.get_field("account_approval_buttons").$wrapper.html('<p class="text-muted small">Total Amount Paid</p><b>USD ' + total_paid_usd.toLocaleString() + ' <br> TZS ' + total_paid_tsh.toLocaleString() + '</b>');
		}

		// Make payment button
		frm.add_custom_button(__('Make Payment'),
			function() {
				frm.events.make_payment(frm);
			}
		);

		// Accounting Ledger button
		frm.add_custom_button(__('Accounting Ledger'), function() {
			frappe.set_route("query-report", "General Ledger", {
				voucher_no: frm.doc.name,
				company: frm.doc.company,
				group_by_voucher: 0
			});
		}, __("View"));

		// Populate child table if reference exists
		if(frm.doc.reference_doctype && frm.doc.reference_docname){
			frm.events.populate_child(frm, frm.doc.reference_doctype, frm.doc.reference_docname);
		}
	},

	make_payment: function(frm) {
		frappe.model.open_mapped_doc({
			method: "vsd_fleet_ms.vsd_fleet_ms.doctype.requested_payment.requested_payment.make_payment",
			frm: frm
		})
	},

	validate_payment: function(frm){
		var to_return = true;
		frm.doc.payment_reference.forEach(function(row){
			if(row.amount <= 0 || !row.date_of_payment || row.date_of_payment == "" || !row.reference_no || row.reference_no == "" || !row.paid_to || row.paid_to == "" || row.payment_method == "" || row.payment_account == "")
			{
				to_return = false;
			}
		});
		return to_return;
	},

	show_hide_sections: function(frm){
		frm.toggle_display(['request_total_amount', 'html1'], (frm.doc.requested_funds.length > 0));
	},

	get_account_currency: function(frm, cdt, cdn, account){
		if(account){
			return frappe.db.get_value('Account', account, 'account_currency').then(r => {
				if(r && r.message && r.message.account_currency){
					return r.message.account_currency;
				}
			});
		}
	},

	// Migrated from cur_frm.cscript.recommend_request
	recommend_request: function(frm){
		var selected = frm.get_selected();
		if(selected['requested_funds'])
		{
			frappe.confirm(
				'Confirm: Recommend selected requests?',
				function(){
					selected['requested_funds'].forEach(function(value){
						frappe.call({
							method: "vsd_fleet_ms.vsd_fleet_ms.doctype.requested_payment.requested_payment.recommend_request",
							freeze: true,
							args: {
								request_doctype: "Requested Fund Details",
								request_docname: value,
								user: frappe.user.full_name()
							},
							callback: function(data){
								// Success callback
							}
						});
					});
					frm.reload_doc();
				},
				function(){
					// Do nothing on cancel
				}
			);
		}
		else
		{
			frappe.show_alert("Error: Please select requests to process.");
		}
	},

	// Migrated from cur_frm.cscript.recommend_against_request
	recommend_against_request: function(frm){
		var selected = frm.get_selected();
		if(selected['requested_funds'])
		{
			frappe.confirm(
				'Confirm: Recommend against the selected requests?',
				function(){
					selected['requested_funds'].forEach(function(value){
						frappe.call({
							method: "vsd_fleet_ms.vsd_fleet_ms.doctype.requested_payment.requested_payment.recommend_against_request",
							freeze: true,
							args: {
								request_doctype: "Requested Fund Details",
								request_docname: value,
								user: frappe.user.full_name()
							},
							callback: function(data){
								// Success callback
							}
						});
					});
					frm.reload_doc();
				},
				function(){
					// Do nothing on cancel
				}
			);
		}
		else
		{
			frappe.show_alert("Error: Please select requests to process.");
		}
	},

	// Migrated from cur_frm.cscript.approve_request
	approve_request: function(frm){
		var selected = frm.get_selected();
		if(selected['requested_funds'])
		{
			frappe.confirm(
				'Confirm: Approve selected requests?',
				function(){
					selected['requested_funds'].forEach(function(value){
						frappe.call({
							method: "vsd_fleet_ms.vsd_fleet_ms.doctype.requested_payment.requested_payment.approve_request",
							freeze: true,
							args: {
								request_doctype: "Requested Fund Details",
								request_docname: value,
								user: frappe.user.full_name()
							},
							callback: function(data){
								// Success callback
							}
						});
					});
					frm.reload_doc();
				},
				function(){
					// Do nothing on cancel
				}
			);
		}
		else
		{
			frappe.show_alert("Error: Please select requests to process.");
		}
	},

	// Migrated from cur_frm.cscript.reject_request
	reject_request: function(frm){
		var selected = frm.get_selected();
		if(selected['requested_funds'])
		{
			frappe.confirm(
				'Confirm: Reject selected requests?',
				function(){
					selected['requested_funds'].forEach(function(value){
						frappe.call({
							method: "vsd_fleet_ms.vsd_fleet_ms.doctype.requested_payment.requested_payment.reject_request",
							freeze: true,
							args: {
								request_doctype: "Requested Fund Details",
								request_docname: value,
								user: frappe.user.full_name()
							},
							callback: function(data){
								// Success callback
							}
						});
					});
					frm.reload_doc();
				},
				function(){
					// Do nothing on cancel
				}
			);
		}
		else
		{
			frappe.show_alert("Error: Please select requests to process.");
		}
	},

	// Migrated from cur_frm.cscript.accounts_approval
	accounts_approval: function(frm){
		var selected = frm.get_selected();
		if(selected['accounts_approval'])
		{
			frappe.confirm(
				'Confirm: Approve selected requests?',
				function(){
					selected['accounts_approval'].forEach(function(value){
						frappe.call({
							method: "vsd_fleet_ms.vsd_fleet_ms.doctype.requested_payment.requested_payment.accounts_approval",
							freeze: true,
							args: {
								request_doctype: "Requested Fund Accounts Table",
								request_docname: value,
								parent_doctype: frm.doctype,
								parent_docname: frm.doc.name,
								local: locals['Requested Fund Accounts Table'][value],
								reference: locals['Requested Fund Accounts Table'][value].reference,
								user: frappe.user.full_name()
							},
							callback: function(data){
								console.log(JSON.stringify(data));
							}
						});
					});
					frappe.after_ajax(function(){
						frm.reload_doc();
					});
				},
				function(){
					// Do nothing on cancel
				}
			);
		}
		else
		{
			frappe.show_alert("Error: Please select requests to process.");
		}
	},

	// Migrated from cur_frm.cscript.accounts_cancel
	accounts_cancel: function(frm){
		var selected = frm.get_selected();
		if(selected['accounts_approval'])
		{
			frappe.confirm(
				'Confirm: Cancel selected requests?',
				function(){
					selected['accounts_approval'].forEach(function(value){
						frappe.call({
							method: "vsd_fleet_ms.vsd_fleet_ms.doctype.requested_payment.requested_payment.accounts_cancel",
							freeze: true,
							args: {
								request_doctype: "Requested Fund Accounts Table",
								request_docname: value,
								parent_doctype: frm.doctype,
								parent_docname: frm.doc.name,
								local: locals['Requested Fund Accounts Table'][value],
								reference: locals['Requested Fund Accounts Table'][value].reference,
								user: frappe.user.full_name()
							},
							callback: function(data){
								console.log(data.message);
							}
						});
					});
					frm.reload_doc();
				},
				function(){
					// Do nothing on cancel
				}
			);
		}
		else
		{
			frappe.show_alert("Error: Please select requests to process.");
		}
	},

	// Migrated from cur_frm.cscript.populate_child
	populate_child: function(frm, reference_doctype, reference_docname){
		frappe.model.with_doc(reference_doctype, reference_docname, function(){
			var request_total_amount_tsh = 0;
			var request_total_amount_usd = 0;
			var reference_doc = frappe.get_doc(reference_doctype, reference_docname);

			// If its from Trips, there is main and return requested funds
			if('Trips' == reference_doctype)
			{
				// For main trip
				reference_doc.requested_fund_accounts_table.forEach(function(row){
					if(row.request_status != "Approved" && row.request_status != "Rejected")
					{
						var new_row = frm.add_child("requested_funds");
						new_row.name = row.name;
						new_row.request_date = row.requested_date;
						new_row.request_amount = row.request_amount;
						new_row.request_currency = row.request_currency;
						new_row.request_description = row.request_description;
						new_row.request_comment = row.request_comment;
						new_row.request_status = row.request_status;
						if(row.request_currency == 'TZS')
						{
							request_total_amount_tsh += row.request_amount;
						}
						else if(row.request_currency == 'USD')
						{
							request_total_amount_usd += row.request_amount;
						}
						frm.refresh_field("requested_funds");
					}
					else{
						console.log("Executing");
						var new_row = frm.add_child("previous_requested_funds");
						new_row.name = row.name;
						new_row.request_date = row.requested_date;
						new_row.request_amount = row.request_amount;
						new_row.request_currency = row.request_currency;
						new_row.request_description = row.request_description;
						new_row.request_comment = row.request_comment;
						new_row.request_status = row.request_status;
						frm.refresh_field("previous_requested_funds");
					}
				});

				// For return trip
				reference_doc.return_requested_funds.forEach(function(row){
					if(row.request_status != "Approved" && row.request_status != "Rejected")
					{
						var new_row = frm.add_child("requested_funds");
						new_row.name = row.name;
						new_row.requested_date = row.request_date;
						new_row.request_amount = row.request_amount;
						new_row.request_currency = row.request_currency;
						new_row.request_description = row.request_description;
						new_row.request_comment = row.request_comment;
						new_row.request_status = row.request_status;
						if(row.request_currency == 'TZS')
						{
							request_total_amount_tsh += row.request_amount;
						}
						else if(row.request_currency == 'USD')
						{
							request_total_amount_usd += row.request_amount;
						}
						frm.refresh_field("requested_funds");
					}
					else{
						var new_row = frm.add_child("previous_requested_funds");
						new_row.name = row.name;
						new_row.requested_date = row.request_date;
						new_row.request_amount = row.request_amount;
						new_row.request_currency = row.request_currency;
						new_row.request_description = row.request_description;
						new_row.request_comment = row.request_comment;
						new_row.request_status = row.request_status;
						frm.refresh_field("previous_requested_funds");
					}
				});
			}
			else
			{
				reference_doc.requested_funds.forEach(function(row){
					if(row.request_status != "Approved" && row.request_status != "Rejected")
					{
						var new_row = frm.add_child("requested_funds");
						new_row.name = row.name;
						new_row.requested_date = row.request_date;
						new_row.request_amount = row.request_amount;
						new_row.request_currency = row.request_currency;
						new_row.request_description = row.request_description;
						new_row.request_comment = row.request_comment;
						new_row.request_status = row.request_status;
						if(row.request_currency == 'TZS')
						{
							request_total_amount_tsh += row.request_amount;
						}
						else if(row.request_currency == 'USD')
						{
							request_total_amount_usd += row.request_amount;
						}
						frm.refresh_field("requested_funds");
					}
					else{
						var new_row = frm.add_child("previous_requested_funds");
						new_row.name = row.name;
						new_row.request_date = row.request_date;
						new_row.request_amount = row.request_amount;
						new_row.request_currency = row.request_currency;
						new_row.request_description = row.request_description;
						new_row.request_comment = row.request_comment;
						new_row.request_status = row.request_status;
						frm.refresh_field("previous_requested_funds");
					}
				});
			}

			if(request_total_amount_tsh != 0 || request_total_amount_usd != 0)
			{
				frm.set_df_property("html1", "hidden", 0);
				console.log(frm.get_field('request_total_amount'));
				frm.get_field("request_total_amount").$wrapper.html('<p class="text-muted small">Total Requested Amount</p><b>USD ' + request_total_amount_usd + ' <br> TZS ' + request_total_amount_tsh.toLocaleString() + '</b>');
			}
			else
			{
				frm.set_df_property("request_total_amount", "hidden", 1);
				frm.set_df_property("html1", "hidden", 1);
			}
		});
	}
});

frappe.ui.form.on('Requested Fund Details', {
	form_render: function(frm, cdt, cdn) {
		frm.fields_dict.requested_funds.grid.wrapper.find('.grid-delete-row').hide();
		frm.fields_dict.requested_funds.grid.wrapper.find('.grid-duplicate-row').hide();
		frm.fields_dict.requested_funds.grid.wrapper.find('.grid-move-row').hide();
		frm.fields_dict.requested_funds.grid.wrapper.find('.grid-append-row').hide();
		frm.fields_dict.requested_funds.grid.wrapper.find('.grid-insert-row-below').hide();
		frm.fields_dict.requested_funds.grid.wrapper.find('.grid-insert-row').hide();
	}
});

frappe.ui.form.on('Requested Fund Accounts Table', {
	form_render: function(frm, cdt, cdn){
		var disburseFundsButton = frm.fields_dict['accounts_approval'];
		disburseFundsButton.$wrapper.find('[data-fieldname="disburse_funds"]').hide();

		frappe.db.get_value('Company', {name: frm.doc.company}, 'cost_center').then(r => {
			if(r && r.message && r.message.cost_center){
				frappe.model.set_value(cdt, cdn, 'cost_center', r.message.cost_center);
			}
		});

		if(!locals[cdt][cdn].posting_date){
			frappe.model.set_value(cdt, cdn, 'posting_date', frappe.datetime.get_today());
		}

		if(locals[cdt][cdn].conversion_rate == 0){
			frappe.model.set_value(cdt, cdn, 'conversion_rate', 1);
		}
	},

	expense_type: function(frm, cdt, cdn){
		frappe.call({
			method: "erpnext.hr.doctype.expense_claim.expense_claim.get_expense_claim_account",
			args: {
				"expense_claim_type": locals[cdt][cdn].expense_type,
				"company": frm.doc.company
			},
			callback: function(r) {
				if (r.message) {
					locals[cdt][cdn].expense_account = r.message.account;
					if(r.message.account){
						frappe.model.set_value(cdt, cdn, 'expense_account_currency', frm.events.get_account_currency(frm, cdt, cdn, r.message.account));
					}
				}
			}
		});
	},

	expense_account: function(frm, cdt, cdn){
		if(locals[cdt][cdn].expense_account){
			var expense_account_currency = frm.events.get_account_currency(frm, cdt, cdn, locals[cdt][cdn].expense_account);
			if(expense_account_currency){
				frappe.model.set_value(cdt, cdn, 'expense_account_currency', expense_account_currency);
			}
		}
	},

	payable_account: function(frm, cdt, cdn){
		if(locals[cdt][cdn].payable_account){
			var payable_account_currency = frm.events.get_account_currency(frm, cdt, cdn, locals[cdt][cdn].payable_account);
			if(payable_account_currency){
				frappe.model.set_value(cdt, cdn, 'payable_account_currency', payable_account_currency);
			}
		}
	}
});

frappe.ui.form.on('Requested Payment', {
	form_render: function(frm, cdt, cdn){
		if(locals[cdt][cdn].status == ""){
		}
	}
});
