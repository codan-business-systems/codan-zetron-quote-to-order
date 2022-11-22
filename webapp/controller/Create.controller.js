/*global location*/
sap.ui.define([
		"dyflex/sd/sales/quotation/controller/ObjectBaseController",
		"sap/ui/model/json/JSONModel",
		"sap/ui/core/routing/History",
		"dyflex/sd/sales/quotation/model/formatter"
	], function (
		BaseController,
		JSONModel,
		History,
		formatter
	) {
		"use strict";

		return BaseController.extend("dyflex.sd.sales.quotation.controller.Create", {

			formatter: formatter,

			/* =========================================================== */
			/* lifecycle methods                                           */
			/* =========================================================== */

			/**
			 * Called when the worklist controller is instantiated.
			 * @public
			 */
			onInit : function () {
				
				// Get value help data for the small datasets
				var manifest = this.getOwnerComponent().getMetadata().getManifestEntry("sap.app");
				this._serviceUrl = manifest.dataSources.mainService.uri;
				
				this.getRouter().getRoute("create").attachPatternMatched(this._onCreateMatched, this);
				
				this._initialiseOtherModels();
			},
			
			/* =========================================================== */
			/* event handlers                                              */
			/* =========================================================== */
			
			/* =========================================================== */
			/* internal methods                                            */
			/* =========================================================== */

			/**
			 * Binds the view to the object path.
			 * @function
			 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
			 * @private
			 */
			_onCreateMatched: function(oEvent) {
				this._oViewModel = new JSONModel(this._getDefaultDetailViewData());
				this.setModel(this._oViewModel, "objectView");
				
				this._oViewModel.setProperty("/editable", true);
				
				var wizard = this.getView().byId("quoteWiz");
				var steps = wizard.getSteps();
				wizard.invalidateStep(steps[0]);
				wizard.discardProgress(steps[0]);
				
				this._createDataModel();
			},
			
			_createDataModel: function() {
				
				var salesQuote = {
					SalesDocument : "",
					Customer : "",
					CustomerName : "",
					Street : "",
					City : "",
					Region : "",
					RegionText : "",
					Country : "",
					CountryText : "",
					PostCode : "",
					OneTimeAcct : false,
					ContactName : "",
					TotalNetAmount : "",
					TransactionCurrency : "",
					OverallSDProcessStatus : "",
					Incoterms1: "",
					Incoterms2: "",
					SystemID : "",
					SysIDNotReq: false,
					PriceSheet : "",
					PriceList : "",
					ContactEmail: "",
					EmailToContact: false,
					EmailToMyself: false,
					SaveSend: false,
					SavePrint: false,
					LongText1: "",
					LongText2: "",
					LongText3: "",
					CustomDiscount: ""
				};
				
				this._oSalesQuote = new JSONModel(salesQuote);
				this.setModel(this._oSalesQuote, "salesQuote");
				
				this._setDefaultOneTimeCustModel(true);
			},
			
			_setViewProperties: function() {
				var oResourceBundle = this.getResourceBundle();
					
				this._oViewModel.setProperty("/busy", false);
				this._oViewModel.setProperty("/saveAsTileTitle", oResourceBundle.getText("saveAsTileTitle", [this._sObjectId]));
				this._oViewModel.setProperty("/shareOnJamTitle", this._sObjectId);
				this._oViewModel.setProperty("/shareSendEmailSubject", oResourceBundle.getText("shareSendEmailObjectSubject", [this._sObjectId]));
				this._oViewModel.setProperty("/shareSendEmailMessage", oResourceBundle.getText("shareSendEmailObjectMessage", [this._sObjectId, this._sObjectId, location.href]));	
			}
			
		});
		
	}
);