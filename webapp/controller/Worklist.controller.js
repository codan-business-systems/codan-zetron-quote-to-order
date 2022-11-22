sap.ui.define([
		"dyflex/sd/sales/quotation/controller/BaseController",
		"sap/ui/model/json/JSONModel",
		"sap/ui/core/routing/History",
		"dyflex/sd/sales/quotation/model/formatter",
		"sap/ui/model/Filter",
		"sap/ui/model/FilterOperator"
	], function (BaseController, JSONModel, History, formatter, Filter, FilterOperator) {
		"use strict";

		return BaseController.extend("dyflex.sd.sales.quotation.controller.Worklist", {

			formatter: formatter,

			/* =========================================================== */
			/* lifecycle methods                                           */
			/* =========================================================== */

			/**
			 * Called when the worklist controller is instantiated.
			 * @public
			 */
			onInit : function () {
				
				this._oTable = this.byId("idWorklistTable");

				// Put down worklist table's original value for busy indicator delay,
				// so it can be restored later on. Busy handling on the table is
				// taken care of by the table itself.
				var iOriginalBusyDelay = this._oTable.getBusyIndicatorDelay();

				// Model used to manipulate control states
				var oViewModel = new JSONModel({
					worklistTableTitle : this.getResourceBundle().getText("worklistTableTitle"),
					saveAsTileTitle: this.getResourceBundle().getText("worklistViewTitle"),
					shareOnJamTitle: this.getResourceBundle().getText("worklistViewTitle"),
					shareSendEmailSubject: this.getResourceBundle().getText("shareSendEmailWorklistSubject"),
					shareSendEmailMessage: this.getResourceBundle().getText("shareSendEmailWorklistMessage", [location.href]),
					tableNoDataText : this.getResourceBundle().getText("tableNoDataText"),
					tableBusyDelay : 0,
					tabSelectedKey: "ALL"
				});
				this.setModel(oViewModel, "worklistView");
				
				this.getRouter().getRoute("worklist").attachPatternMatched(this._onWorklistMatched, this);
				
				// Make sure, busy indication is showing immediately so there is no
				// break after the busy indication for loading the view's meta data is
				// ended (see promise 'oWhenMetadataIsLoaded' in AppController)
				this._oTable.attachEventOnce("updateFinished", function(){
					// Restore original busy indicator delay for worklist's table
					oViewModel.setProperty("/tableBusyDelay", iOriginalBusyDelay);
				});
			},

			/* =========================================================== */
			/* event handlers                                              */
			/* =========================================================== */

			/**
			 * Triggered by the table's 'updateFinished' event: after new table
			 * data is available, this handler method updates the table counter.
			 * This should only happen if the update was successful, which is
			 * why this handler is attached to 'updateFinished' and not to the
			 * table's list binding's 'dataReceived' method.
			 * @param {sap.ui.base.Event} oEvent the update finished event
			 * @public
			 */
			onUpdateFinished : function (oEvent) {
				// update the worklist's object counter after the table update
				var sTitle,
					oTable = oEvent.getSource(),
					iTotalItems = oEvent.getParameter("total");
				// only update the counter if the length is final and
				// the table is not empty
				if (iTotalItems && oTable.getBinding("items").isLengthFinal()) {
					sTitle = this.getResourceBundle().getText("worklistTableTitleCount", [iTotalItems]);
				} else {
					sTitle = this.getResourceBundle().getText("worklistTableTitle");
				}
				this.getModel("worklistView").setProperty("/worklistTableTitle", sTitle);
			},

			/**
			 * Event handler when a table item gets pressed
			 * @param {sap.ui.base.Event} oEvent the table selectionChange event
			 * @public
			 */
			onItemPress : function (oEvent) {
				// The source is the list item that got pressed
				this._showObject(oEvent.getSource());
			},
			
			onCreateQuote : function (oEvent) {
				this.getRouter().navTo("create");
			},
			
			/**
			 * Event handler for navigating back.
			 * It there is a history entry or an previous app-to-app navigation we go one step back in the browser history
			 * If not, it will navigate to the shell home
			 * @public
			 */
			onNavBack : function() {
				var sPreviousHash = History.getInstance().getPreviousHash(),
					oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");

				if (sPreviousHash !== undefined || !oCrossAppNavigator.isInitialNavigation()) {
					history.go(-1);
				} else {
					oCrossAppNavigator.toExternal({
						target: {shellHash: "#Shell-home"}
					});
				}
			},
			
			onSearch : function (oEvent) {
				if (oEvent.getParameters().refreshButtonPressed) {
					// Search field's 'refresh' button has been pressed.
					// This is visible if you select any master list item.
					// In this case no new search is triggered, we only
					// refresh the list binding.
					this.onRefresh();
				} else {
					var sQuery = oEvent.getParameter("query");
					this._prepareSearch(sQuery);
				}
			},
			
			_prepareSearch: function(sQuery) {
				var oTableSearchState = [];
				
				// Add Tab Filter
				if (this.getModel("worklistView").getProperty("/tabSelectedKey") === "DRAFT") {
					oTableSearchState.push(new Filter("OverallSDProcessStatus", FilterOperator.EQ, "D"));
				} else if (this.getModel("worklistView").getProperty("/tabSelectedKey") === "QUOTES") {
					oTableSearchState.push(new Filter("OverallSDProcessStatus", FilterOperator.EQ, "A"));
				}
				
				// Add Query Filter
				if (sQuery && sQuery.length > 0) {
					var aFilters = [];
					aFilters.push(new Filter("SalesDocument", FilterOperator.Contains, sQuery));
					aFilters.push(new Filter("Customer", FilterOperator.Contains, sQuery));
					aFilters.push(new Filter("CustomerNameUp", FilterOperator.Contains, sQuery.toUpperCase()));
					
					if (sQuery.toUpperCase() === "DRAFT") {
						aFilters.push(new Filter("OverallSDProcessStatus", FilterOperator.EQ, "D"));
					}
					oTableSearchState.push(new Filter(aFilters, false));
				}
				this._applySearch(oTableSearchState);
			},
			
			/**
			 * Event handler for refresh event. Keeps filter, sort
			 * and group settings and refreshes the list binding.
			 * @public
			 */
			onRefresh : function () {
				this._refreshAll();
			},
			
			onFilterSelect: function() {
				this._prepareSearch(this.byId("searchField").getValue());
			},
			
			/* =========================================================== */
			/* internal methods                                            */
			/* =========================================================== */

			/**
			 * Shows the selected item on the object page
			 * On phones a additional history entry is created
			 * @param {sap.m.ObjectListItem} oItem selected Item
			 * @private
			 */
			_showObject : function (oItem) {
				this.getRouter().navTo("object", {
					objectId: oItem.getBindingContext().getProperty("SalesDocument")
				});
			},

			/**
			 * Internal helper method to apply both filter and search state together on the list binding
			 * @param {object} oTableSearchState an array of filters for the search
			 * @private
			 */
			_applySearch: function(oTableSearchState) {
				var oViewModel = this.getModel("worklistView");
				this._oTable.getBinding("items").filter(oTableSearchState, "Application");
				// changes the noDataText of the list in case there are no filter results
				if (oTableSearchState.length !== 0) {
					oViewModel.setProperty("/tableNoDataText", this.getResourceBundle().getText("worklistNoDataWithSearchText"));
				}
			},
			
			_onWorklistMatched: function() {
				if (!this.bLoaded) {
					this.bLoaded = true;
				} else {
					this._refreshAll();
				}
			},
			
			_refreshAll: function() {
				this._oTable.getBinding("items").refresh(true);
			}

		});
	}
);