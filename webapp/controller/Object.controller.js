/*global location*/
sap.ui.define([
		"dyflex/sd/sales/quotation/controller/ObjectBaseController",
		"sap/ui/model/json/JSONModel",
		"sap/ui/core/routing/History",
		"dyflex/sd/sales/quotation/model/formatter",
		"sap/m/MessageToast",
		"sap/m/MessageBox"
	], function (
		BaseController,
		JSONModel,
		History,
		formatter,
		MessageToast,
		MessageBox
	) {
		"use strict";

		return BaseController.extend("dyflex.sd.sales.quotation.controller.Object", {

			formatter: formatter,

			/* =========================================================== */
			/* lifecycle methods                                           */
			/* =========================================================== */

			/**
			 * Called when the worklist controller is instantiated.
			 * @public
			 */
			onInit: function() {
				
				// Get value help data for the small datasets
				var manifest = this.getOwnerComponent().getMetadata().getManifestEntry("sap.app");
				this._serviceUrl = manifest.dataSources.mainService.uri;
				
				this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);
				
				this._initialiseOtherModels();
			},

			/* =========================================================== */
			/* event handlers                                              */
			/* =========================================================== */
			
			onCopyQuote: function() {
				this._oSalesQuote.setProperty("/SalesDocument", "");
				this._oViewModel.setProperty("/editable", true);
				this._oViewModel.setProperty("/showCopyButton", false);
				this._oViewModel.setProperty("/objectTitle", this.getResourceBundle().getText("titleNewQuotation"));
				this._addSelectedProductsToModel();
			},
			
			/* ========================================================== */
			/* Delete Draft Methods							 			  */
			/* ========================================================== */
			
			onDeleteDraft: function() {
				MessageBox.confirm(this.getResourceBundle().getText("msgConfirmDeleteDraft"), {
					title: this.getResourceBundle().getText("msgDataLossConfirmation"),
					onClose: function(oAction) {
						if (oAction === MessageBox.Action.OK) {
							this._deleteDraftPost();
						}
					}.bind(this)
				});
			},
			
			_deleteDraftPost: function() {
				this._oViewModel.setProperty("/busy", true);
				
				this.getModel().callFunction("/DeleteDraftQuote", {
					method: "POST",
					urlParameters: { "SalesDocument": this._sObjectId },
					success: this._deleteDraftSuccess.bind(this),
					error: this._deleteDraftFailed.bind(this)
				});
			},
			
			_deleteDraftSuccess: function() {
				this._oViewModel.setProperty("/busy", false);
				this.getModel().refresh(true, true);
				
				var msg = this.getResourceBundle().getText("deleteDraftSuccessMsg");
				MessageToast.show( msg, { duration: 3000, closeOnBrowserNavigation: false });
				
				this._navToWorklist();
			},
			
			_deleteDraftFailed: function() {
				this._oViewModel.setProperty("/busy", false);
			},
			
			/* =========================================================== */
			/* internal methods                                            */
			/* =========================================================== */

			/**
			 * Binds the view to the object path.
			 * @function
			 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
			 * @private
			 */
			_onObjectMatched: function(oEvent) {
				this._sObjectId =  oEvent.getParameter("arguments").objectId;
				this._openExistingQuote();
			},
			
			_openExistingQuote: function() {
				
				this._oViewModel = new JSONModel(this._getDefaultDetailViewData());
				this.setModel(this._oViewModel, "objectView");
					
				this._getQuoteDetails();
				
				// Set all steps as validated
				this._oViewModel.setProperty("/validated", {
					customer: true,
					selectPackage: true,
					configurePackage: true
				});
				var wiz = this.getView().byId("quoteWiz");
				wiz.setShowNextButton(false);
	
				for (var j = 0; j < wiz.getSteps().length; j++) {
					wiz.nextStep();
				}
				wiz.goToStep(wiz.getSteps()[0]);
			},
			
			_getQuoteDetails: function() {
				var that = this;
				
				this._oViewModel.setProperty("/busy", true);
				var expand = "&$expand=to_PriceSheet/to_Category/to_Parts/to_PartsBom,to_Item/to_ItemBom,to_ItemAdhoc/to_PartsBom,to_ItemCat,to_Discount"; 
				var oSalesQuote = new JSONModel(this._serviceUrl + "ZI_SQuote_Header('" + this._sObjectId + "')?$format=json" + expand);
				
				oSalesQuote.attachRequestCompleted({}, function(oEvent) {
					that._handleJSONModelError(oEvent);
					that._prepareDataModel(oSalesQuote);
					that._setEndUserModel();
					that._setFuncLocModel();
					that._setContactModel();
					that._addSelectedProductsToModel();
					that._getMaterialPriceModel();
					that._setDefaultOneTimeCustModel(false);
					that._setViewProperties();
					that._oViewModel.setProperty("/busy", false);
				});
			},
			
			_prepareDataModel: function(oSalesQuote) {
				var salesQuote = oSalesQuote.getData().d;
				
				// Add Existing Values
				salesQuote = this._addExistingValue(salesQuote);
				
				this._oSalesQuote = new JSONModel(salesQuote);
				this.setModel(this._oSalesQuote, "salesQuote");
			},
			
			_addExistingValue: function(salesQuote) {
				
				var aCategory = this._sortSequence( salesQuote.to_PriceSheet.to_Category.results );
				
				for (var i = 0; i < aCategory.length; i++) {
					
					// Add Category Long Text
					var oItemCat = salesQuote.to_ItemCat.results.find(function(obj) {
						return obj.Category === aCategory[i].Category;
					});
					if (oItemCat) {
						aCategory[i].LongText    = oItemCat.GeneralText;
						aCategory[i].LTxtDefault = oItemCat.GTxtDefault;
					}
					
					// On Adhoc category, add the adhoc items used to category parts
					if (aCategory[i].Adhoc) {
						for (var z = 0; z < salesQuote.to_ItemAdhoc.results.length; z++) {
							if (aCategory[i].Category === salesQuote.to_ItemAdhoc.results[z].Category) {
								aCategory[i].to_Parts.results.push(salesQuote.to_ItemAdhoc.results[z]);
							} 
						}
					}
					
					var aParts = this._sortSequence( aCategory[i].to_Parts.results );
					
					for (var j = 0; j < aParts.length; j++) {
						
						var aItems = salesQuote.to_Item.results;
						for (var x = 0; x < aItems.length; x++) {
							if (aParts[j].Category === aItems[x].Category &&
								aParts[j].Material === aItems[x].Material) {
									
								aParts[j].OrderQuantity = aItems[x].OrderQuantity;
								aParts[j].Discount		= aItems[x].Discount;
								aParts[j].UnitPrice		= aItems[x].UnitPrice;
								aParts[j].NetPrice		= aItems[x].NetPrice;
								aParts[j].NetAmount		= aItems[x].NetAmount;
								aParts[j].PriceList		= aItems[x].PriceList;
								aParts[j].GeneralText	= aItems[x].GeneralText;
								aParts[j].GTxtDefault	= aItems[x].GTxtDefault;
								aParts[j].ConfigText	= aItems[x].ConfigText;
								aParts[j].CTxtDefault	= aItems[x].CTxtDefault;
									
								var aPartsBom = aParts[j].to_PartsBom.results;
								for (var k = 0; k < aPartsBom.length; k++) {
									
									var oItemBom = aItems[x].to_ItemBom.results.find(function(obj) {
										return obj.Material === aPartsBom[k].Material;
									});
									if (oItemBom) {
										aPartsBom[k].OrderQuantity = oItemBom.OrderQuantity;
										aPartsBom[k].Discount	   = oItemBom.Discount;
										aPartsBom[k].UnitPrice	   = oItemBom.UnitPrice;
										aPartsBom[k].NetPrice	   = oItemBom.NetPrice;
										aPartsBom[k].NetAmount	   = oItemBom.NetAmount;
										aPartsBom[k].PriceList	   = oItemBom.PriceList;
										aPartsBom[k].GeneralText   = oItemBom.GeneralText;
										aPartsBom[k].GTxtDefault   = oItemBom.GTxtDefault;
										aPartsBom[k].ConfigText	   = oItemBom.ConfigText;
										aPartsBom[k].CTxtDefault   = oItemBom.CTxtDefault;
										aPartsBom[k].Deleted	   = oItemBom.Deleted;
										aPartsBom[k].FreeItem	   = Number(oItemBom.Discount) >= 100 ? true : false;
									}
								}
								aParts[j].to_PartsBom.results = aPartsBom;
								
								break;	// exit for loop
							}
						}
						
						// Add the default discount for items haven't added yet 
						if (!aParts[j].Discount) {
							aParts[j].Discount = this._getCustomDiscount(salesQuote.CustomDiscount, aParts[j].PricingGroup);
						}
					}
					
					// On Adhoc category, remove items that doesn't have quantity
					if (aCategory[i].Adhoc) {
						aParts = aParts.filter(this._checkOrderQuantity);
					}
					
					aCategory[i].to_Parts.results = aParts;
				}
				salesQuote.to_PriceSheet.to_Category.results = aCategory;
				
				return salesQuote;
			},
			
			_checkOrderQuantity: function(oItem) {
				return Number(oItem.OrderQuantity) > 0;
			},
			
			_setViewProperties: function() {
				
				if (this._oSalesQuote.getProperty("/OverallSDProcessStatus") === "D") {
					this._oViewModel.setProperty("/editable", true);
					this._oViewModel.setProperty("/showCopyButton", false);
					this._oViewModel.setProperty("/objectTitle", this.getResourceBundle().getText("titleEditDraftQuote"));	
				} else {
					this._oViewModel.setProperty("/editable", false);
					this._oViewModel.setProperty("/showCopyButton", true);
					this._oViewModel.setProperty("/objectTitle", this.getResourceBundle().getText("displayDocumentNo", this._sObjectId));
				}
					
				this._oViewModel.setProperty("/busy", false);
				this._oViewModel.setProperty("/saveAsTileTitle", this.getResourceBundle().getText("saveAsTileTitle", [this._sObjectId]));
				this._oViewModel.setProperty("/shareOnJamTitle", this._sObjectId);
				this._oViewModel.setProperty("/shareSendEmailSubject", this.getResourceBundle().getText("shareSendEmailObjectSubject", [this._sObjectId]));
				this._oViewModel.setProperty("/shareSendEmailMessage", this.getResourceBundle().getText("shareSendEmailObjectMessage", [this._sObjectId, this._sObjectId, location.href]));	
			}
			
		});
		
	}
);