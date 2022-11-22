sap.ui.define([
	"dyflex/sd/sales/quotation/controller/BaseController",
	"dyflex/sd/sales/quotation/model/formatter",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/MessageToast",
	"sap/m/MessageBox"
], function (BaseController, formatter, JSONModel, Filter, FilterOperator, MessageToast, MessageBox) {
	"use strict";
	
	return BaseController.extend("dyflex.sd.sales.quotation.controller.ObjectBaseController", {
		
		formatter: formatter,
		
		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */
		
		onCancel: function() {
			MessageBox.confirm(this.getResourceBundle().getText("msgConfirmCancel"), {
				title: this.getResourceBundle().getText("msgDataLossConfirmation"),
				onClose: function(oAction) {
					if (oAction === MessageBox.Action.OK) {
						this._navToWorklist();
					}
				}.bind(this)
			});
		},
		
		/**
		 * Event handler  for navigating back.
		 * It there is a history entry or an previous app-to-app navigation we go one step back in the browser history
		 * If not, it will replace the current entry of the browser history with the worklist route.
		 * @public
		 */
		onNavBack : function() {
			this._navToWorklist();
		},
		
		onProductQtyAdd: function(oEvent) {
			this._adjustProductQty(oEvent, 1);
		},
		
		onProductQtyMinus: function(oEvent) {
			this._adjustProductQty(oEvent, -1);
		},
		
		onDiscountChange: function(oEvent) {
			var path = oEvent.getSource().getParent().getBindingContextPath();
			
			var pricingGroup = this._oViewModel.getProperty(path + "/PricingGroup");
			if (pricingGroup === "Z1" || pricingGroup === "Z2") {
				MessageBox.alert(this.getResourceBundle().getText("msgNoDiscountChanged"));
			}
			
			this._oViewModel.setProperty(path + "/Discount", oEvent.getParameter("newValue") || Number(0));
			this._addSelectedProductsToModel();
		},
		
		onSetFreeItem: function(oEvent) {
			var path = oEvent.getSource().getParent().getBindingContextPath();
			
			if (oEvent.getParameter("state")) {
				this._oViewModel.setProperty(path + "/Discount", "100");
			} else {
				var customDiscount = this._oSalesQuote.getProperty("/CustomDiscount");
				var pricingGroup = this._oViewModel.getProperty(path + "/PricingGroup");
				this._oViewModel.setProperty(path + "/Discount", this._getCustomDiscount(customDiscount, pricingGroup));
			}
			this._addSelectedProductsToModel();
		},
		
		onDeleteItem: function(oEvent) {
			var path = oEvent.getParameter("listItem").getBindingContextPath();
			this._oViewModel.setProperty(path + "/UnitPrice", 0);
			this._oViewModel.setProperty(path + "/Deleted", true);
			this._addSelectedProductsToModel();
		},
		
		onPriceSheetChange: function() {
			this._getPriceSheetDetails();
		},
		
		onPriceListChange: function() {
			this._getMaterialPriceModel();
			this._getDiscountModel();
			this.checkMandatoryCustFields();
		},
		
		onCurrencyChange: function() {
			this._getMaterialPriceModel();
			this.checkMandatoryCustFields();	
		},
		
		onEndUserChange: function() {
			this._setFuncLocModel();
			this.checkMandatoryCustFields();
		},
		
		onHeaderDiscountChange: function(oEvent) {
			if (!oEvent.getSource().getValue()) {
				oEvent.getSource().setValue("0");
			}
			this._updateProductDiscounts();
		},
		
		onContactPersonChange: function(oEvent) {
			
			var contactPerson = this._oSalesQuote.getProperty("/ContactPerson");
			var aContacts = this.getModel("contactModel").getData().d.results;
			
			var oContact = aContacts.find(function(obj) {
				return obj.ContactPerson  === contactPerson;
			});
			
			this._oSalesQuote.setProperty("/ContactName",	 oContact ? oContact.ContactName  : "");
			this._oSalesQuote.setProperty("/ContactAddress", oContact ? oContact.Address      : "");
			this._oSalesQuote.setProperty("/ContactPhone",   oContact ? oContact.Telephone    : "");
			this._oSalesQuote.setProperty("/ContactEmail",   oContact ? oContact.EmailAddress : "");
		},
		
		onSelectProductDiscountChange: function(oEvent) {
			var sPath = oEvent.getSource().getParent().getParent().getBindingContextPath();
			var oData = this._oSalesQuote.getProperty(sPath);
			
			if (oData.PricingGroup === "Z1" || oData.PricingGroup === "Z2") {
				MessageBox.alert(this.getResourceBundle().getText("msgNoDiscountChanged"));
			}
			
			oData.to_PartsBom.results.forEach((oBom) => {
				if (!oBom.FreeItem) {
					oBom.Discount = oData.Discount;
				}
			});
			
			this._oSalesQuote.setProperty(sPath, oData);
			this._addSelectedProductsToModel();
		},
		
		onSelectProductOrderQtyChange: function(oEvent) {
			var sPath = oEvent.getSource().getParent().getParent().getBindingContextPath();
			var oData = this._oSalesQuote.getProperty(sPath);
			
			var editable = this._checkOrderQtyEditable(oData);
			if (editable) {
				this._addSelectedProductsToModel();
			} else {
				oEvent.getSource().setValue("0");
				MessageBox.alert(this.getResourceBundle().getText("msgNoPriceItem"));
			}
		},
		
		onSystemIdChange: function() {
			this._oSalesQuote.setProperty("/SysIDNotReq", false); 
			this.checkMandatoryCustFields();
		},
		
		onCreateNewSystemIdChange: function() {
			this._oSalesQuote.setProperty("/SystemID", ""); 
			this.checkMandatoryCustFields();
		},
		
		/* ========================================================== */
		/* SAVE Methods							 					  */
		/* ========================================================== */

		onSaveQuote: function() {
			var salesQuote = this._oSalesQuote.getData();
			
			if (salesQuote.EmailToContact || salesQuote.EmailToMyself) {
				this._oViewModel.setProperty("/printDialogMode", "saveSend");
				this.openPrintDialog();
			} else {
				this._oViewModel.setProperty("/printDialogMode", "");
				this._saveEntity();
			}
		},
		
		onSavePrint: function() {
			this._oViewModel.setProperty("/printDialogMode", "savePrint");
			this.openPrintDialog();
		},
		
		onSaveAsDraft: function() {
			this._oViewModel.setProperty("/printDialogMode", "");
			this._saveEntity("D");
		},
		
		_saveEntity: function(status) {
			
			this._oViewModel.setProperty("/busy", true);
			var salesQuote = this._oSalesQuote.getData();
			
			var oHeader = {
				"SalesDocument"			 : salesQuote.SalesDocument,
				"TotalNetAmount"		 : this._oViewModel.getProperty("/grandTotal").toString(),
				"TransactionCurrency"	 : salesQuote.TransactionCurrency,
				"Incoterms1"			 : salesQuote.Incoterms1,
				"Incoterms2"			 : salesQuote.Incoterms2,
				"SystemID"				 : salesQuote.SystemID,
				"SysIDNotReq"			 : salesQuote.SysIDNotReq,
				"PriceSheet"			 : salesQuote.PriceSheet,
				"PriceList" 			 : salesQuote.PriceList,
				"Customer"				 : salesQuote.Customer,
				"CustomerName"			 : salesQuote.CustomerName,
				"CustomerNameUp"		 : salesQuote.CustomerName.toUpperCase().substr(0, 25),
				"Street"				 : salesQuote.Street,
				"City"					 : salesQuote.City,
				"Region"				 : salesQuote.Region,
				"RegionText"			 : salesQuote.RegionText,
				"Country"				 : salesQuote.Country,
				"CountryText"			 : salesQuote.CountryText,
				"PostCode"				 : salesQuote.PostCode,
				"OneTimeAcct"			 : salesQuote.OneTimeAcct,
				"EndUser"				 : salesQuote.EndUser,
				"ContactPerson"			 : salesQuote.ContactPerson,
				"EmailToContact"		 : salesQuote.EmailToContact,
				"EmailToMyself"			 : salesQuote.EmailToMyself,
				"SaveSend"				 : salesQuote.SaveSend,
				"SavePrint"				 : salesQuote.SavePrint,
				"LongText1"				 : salesQuote.LongText1,
				"LongText2"				 : salesQuote.LongText2,
				"LongText3"				 : salesQuote.LongText3,
				"CustomDiscount"		 : salesQuote.CustomDiscount.toString(),
				"OverallSDProcessStatus" : status,
				"to_ItemAll"			 : []
			};
			
			var catItemNo, docItemNo, bomItemNo, newItemNo = 0;
			
			var aCategory = [];
			var aProducts = this._oViewModel.getProperty("/selectedProducts");
			
			for (var z = 0; z < aProducts.length; z++) {
				
				// Add Categories (if haven't added yet)
				if (!aCategory.includes(aProducts[z].Category)) {
					
					aCategory.push(aProducts[z].Category);
					
					newItemNo += 10;
					catItemNo = newItemNo;
					
					var categoryData = salesQuote.to_PriceSheet.to_Category.results.find(function(obj) {
						return obj.Category  === aProducts[z].Category;
					});
					
					var oCategory = {
						"SalesDocument"		: salesQuote.SalesDocument,
						"SalesDocumentItem"	: this._pad(catItemNo, 6),
						"Category"			: aProducts[z].Category,
						"MaterialDesc"		: categoryData.Description,
						"GeneralText"		: categoryData.LongText,
						"GTxtDefault"		: categoryData.LTxtDefault
					};
					oHeader.to_ItemAll.push(oCategory);
				}
				
				var aBomItem = aProducts[z].to_PartsBom.results;
				
				// Add Items (if not an Adhoc without BOM, as that will be added in Bom Items)
				if (aBomItem.length > 1 || aBomItem[0].Material !== aProducts[z].Material) {
					
					newItemNo += 10;
					docItemNo = newItemNo;
					
					var oItem = {
						"SalesDocument"		: salesQuote.SalesDocument,
						"SalesDocumentItem"	: this._pad(docItemNo, 6),
						"HigherLevelItem"	: this._pad(catItemNo, 6),
						"Material"			: aProducts[z].Material,
						"NetAmount"			: aProducts[z].NetAmount.toString(),
						"NetPrice"			: aProducts[z].NetPrice  ? aProducts[z].NetPrice.toString()  : "0",
						"UnitPrice"			: aProducts[z].UnitPrice ? aProducts[z].UnitPrice.toString() : "0",
						"Discount" 			: aProducts[z].Discount  ? aProducts[z].Discount.toString()  : "0",
						"CustomDiscount"    : aProducts[z].Discount  ? aProducts[z].Discount.toString()  : "0",
						"OrderQuantity"		: aProducts[z].OrderQuantity.toString(),
						"OrderUnit"			: aProducts[z].OrderUnit,
						"Category"			: aProducts[z].Category,
						"GeneralText"		: aProducts[z].GeneralText,
						"GTxtDefault"		: aProducts[z].GTxtDefault,
						"ConfigText"		: aProducts[z].ConfigText,
						"CTxtDefault"		: aProducts[z].CTxtDefault
					};
					oHeader.to_ItemAll.push(oItem);
				
				} else {
					// Use the category no here as this will be used as HL Item in Bom
					docItemNo = catItemNo;
				}
				
				// Add BoM Items
				for (var x = 0; x < aBomItem.length; x++) {
					if (aBomItem[x].UnitPrice) {
						
						newItemNo += 10;
						bomItemNo = newItemNo;
						
						// Only including Order Qty and Unit for Adhoc Item without Bom
						// Otherwise, the value here will be added to the Bom exploded item value
						
						var oBomItem = {
							"SalesDocument"		: salesQuote.SalesDocument,
							"SalesDocumentItem"	: this._pad(bomItemNo, 6),
							"HigherLevelItem"	: this._pad(docItemNo, 6),
							"Material"			: aBomItem[x].Material,
							"NetAmount"			: aBomItem[x].NetAmount.toString(),
							"NetPrice"			: aBomItem[x].NetPrice.toString(),
							"UnitPrice"			: aBomItem[x].UnitPrice.toString(),
							"Discount" 			: aBomItem[x].Discount ? aBomItem[x].Discount.toString() : "0",
							"CustomDiscount"    : aBomItem[x].Discount ? aBomItem[x].Discount.toString() : "0",
							"OrderQuantity"		: aBomItem[x].OrderQuantity.toString(),
							"OrderUnit"			: aBomItem[x].OrderUnit,
							"BomItemNode"		: aBomItem[x].BomItemNo,
							"BomHdrNo"			: aBomItem[x].BomNo,
							"Category"			: aProducts[z].Category,
							"Deleted"			: aBomItem[x].Deleted,
							"GeneralText"		: aBomItem[x].GeneralText,
							"GTxtDefault"		: aBomItem[x].GTxtDefault,
							"ConfigText"		: aBomItem[x].ConfigText,
							"CTxtDefault"		: aBomItem[x].CTxtDefault
						};
						
						oHeader.to_ItemAll.push(oBomItem);
					}
				}
			}
			
			this.getModel().create("/ZI_SQuote_Header", oHeader, {
				success: this._saveEntitySuccess.bind(this),
				error: this._saveEntityFailed.bind(this)
			});
		},
		
		_saveEntitySuccess: function(oData) {
			this._oViewModel.setProperty("/busy", false);
			this.getModel().refresh(true, true);
			
			var msg = "";
			if (oData.OverallSDProcessStatus === "D") {
				msg = this.getResourceBundle().getText("draftSuccessMsg");
			} else {
				this._sObjectId = oData.SalesDocument;
				msg = this.getResourceBundle().getText("createSuccessMsg", oData.SalesDocument);
			}
			
			switch (this._oViewModel.getProperty("/printDialogMode")) {
				case "savePrint":
					this.printQuote();
					break;
				case "saveSend":
					this.sendEmail();
					break;
			}
			
			MessageToast.show( msg, { duration: 3000, closeOnBrowserNavigation: false });
			this._navToWorklist();
		},
		
		_saveEntityFailed: function() {
			this._oViewModel.setProperty("/busy", false);
		},
		
		/* ========================================================== */
		/* Customer Wizard Step Methods							 	  */
		/* ========================================================== */
		
		oneTimeChanged: function(oEvent) {
			this._setCustomerFields();
			this.checkMandatoryCustFields();
		},
		
		checkMandatoryCustFields: function() {
			var salesQuote = this._oSalesQuote.getData();
			var bResult = !!salesQuote.PriceSheet && !!salesQuote.PriceList && !!salesQuote.EndUser && 
						  !( !!salesQuote.SystemID && !!salesQuote.SysIDNotReq ) &&
						  ( 
						  	(!salesQuote.OneTimeAcct && !!salesQuote.Customer ) ||
						    (!!salesQuote.OneTimeAcct && !!salesQuote.Country && !!salesQuote.PostCode && !!salesQuote.CustomerName && !!salesQuote.City)
						  );
				
			this._oViewModel.setProperty("/validated/customer", bResult);
			this._checkSaveEnablement();
		},
		
		/* ========================================================== */
		/* Customer Value Help Dialog 							 	  */
		/* ========================================================== */
		
		showCustomerDialog: function() {
			if (!this._oCustomerDialog) {
				this._oCustomerDialog = sap.ui.xmlfragment("dyflex.sd.sales.quotation.fragments.CustomerSearchDialog", this);
				this.getView().addDependent(this._oCustomerDialog);
				jQuery.sap.syncStyleClass("sapUiSizeCompact", this.getView(), this._oCustomerDialog);
			}
			this._oCustomerDialog.open();
		},
		
		searchCustomers: function(oEvent) {
			var searchString = oEvent.getParameter("value");
			var aFilters = this._createCustomerFilter(searchString);
			oEvent.getSource().getBinding("items").filter(aFilters);
		},
		
		closeCustomerDialog: function(oEvent) {
			var selectedItem = oEvent.getParameter("selectedItem");
			this._setCustomerFields(selectedItem.getCells()[0]);
			this.checkMandatoryCustFields();
			oEvent.getSource().getBinding("items").filter([]);
		},
		
		_createCustomerFilter: function(sValue) {
			var aFilters = [];
			aFilters.push(new Filter("Customer", sap.ui.model.FilterOperator.Contains, sValue));
			aFilters.push(new Filter("CustomerNameUp", sap.ui.model.FilterOperator.Contains, sValue.toUpperCase()));
			return new Filter(aFilters, false);
		},
		
		_setCustomerFields: function(oData) {
			var oneTimeCust = parseInt(this.getModel("defaultOneTimeCust").getProperty("/d/Value"), 10).toString();
			
			this._oSalesQuote.setProperty("/Customer",				oData ? oData.data("Customer")	   : oneTimeCust );
			this._oSalesQuote.setProperty("/CustomerName",			oData ? oData.data("CustomerName") : "" );
			this._oSalesQuote.setProperty("/Street",				oData ? oData.data("Street")	   : "" );
			this._oSalesQuote.setProperty("/City",					oData ? oData.data("City")		   : "" );
			this._oSalesQuote.setProperty("/Region",				oData ? oData.data("Region")	   : "" );
			this._oSalesQuote.setProperty("/RegionText",			oData ? oData.data("RegionText")   : "" );
			this._oSalesQuote.setProperty("/Country",				oData ? oData.data("Country")	   : "" );
			this._oSalesQuote.setProperty("/CountryText",			oData ? oData.data("CountryText")  : "" );
			this._oSalesQuote.setProperty("/PostCode",				oData ? oData.data("PostCode")	   : "" );
			this._oSalesQuote.setProperty("/ContactName",			oData ? oData.data("ContactName")  : "" );
			this._oSalesQuote.setProperty("/TransactionCurrency",	oData ? oData.data("Currency")	   : this._oSalesQuote.getProperty("/TransactionCurrency") );
			this._oSalesQuote.setProperty("/Incoterms1",			oData ? oData.data("Incoterms1")   : this._oSalesQuote.getProperty("/Incoterms1") );
			this._oSalesQuote.setProperty("/Incoterms2",			oData ? oData.data("Incoterms2")   : this._oSalesQuote.getProperty("/Incoterms2") );
			
			this._oSalesQuote.setProperty("/SystemID", ""); 
			this._setEndUserModel();
			this._setContactModel();
			this._getMaterialPriceModel();
			this._getDiscountModel();
		},
		
		/* ========================================================== */
		/* Country Value Help Dialog 							 	  */
		/* ========================================================== */
		
		showCountryDialog: function() {
			if (!this._oCountryDialog) {
				this._oCountryDialog = sap.ui.xmlfragment("dyflex.sd.sales.quotation.fragments.CountrySearchDialog", this);
				this.getView().addDependent(this._oCountryDialog);
				jQuery.sap.syncStyleClass("sapUiSizeCompact", this.getView(), this._oCountryDialog);
			}
			this._oCountryDialog.open();
		},
		
		searchCountry: function(oEvent) {
			var searchString = oEvent.getParameter("value");
			var aFilters = this._createCountryFilter(searchString);
			oEvent.getSource().getBinding("items").filter(aFilters);
		},
		
		closeCountryDialog: function(oEvent) {
			var selectedItem = oEvent.getParameter("selectedItem");
			this._setCountryFields(selectedItem.getCells()[0]);
			this.checkMandatoryCustFields();
			oEvent.getSource().getBinding("items").filter([]);
		},
		
		_createCountryFilter: function(sValue) {
			var aFilters = [];
			aFilters.push(new Filter("name", sap.ui.model.FilterOperator.Contains, sValue));
			aFilters.push(new Filter("key", sap.ui.model.FilterOperator.EQ, sValue));
			return new Filter(aFilters, false);
		},
		
		_setCountryFields: function(oData) {
			this._oSalesQuote.setProperty("/Country",	  oData ? oData.data("Country")	    : "" );
			this._oSalesQuote.setProperty("/CountryText", oData ? oData.data("CountryText")	: "" );
			
			this._oSalesQuote.setProperty("/Region", ""); 
			this._oSalesQuote.setProperty("/RegionText", "");
		},
		
		/* ========================================================== */
		/* Region Value Help Dialog 							 	  */
		/* ========================================================== */
		
		showRegionDialog: function() {
			if (!this._oRegionDialog) {
				this._oRegionDialog = sap.ui.xmlfragment("dyflex.sd.sales.quotation.fragments.RegionSearchDialog", this);
				this.getView().addDependent(this._oRegionDialog);
				jQuery.sap.syncStyleClass("sapUiSizeCompact", this.getView(), this._oRegionDialog);
			}
			
			// create a filter for the binding
			var aFilters = this._createRegionFilter("");
			this._oRegionDialog.getBinding("items").filter(aFilters);
			
			this._oRegionDialog.open();
		},
		
		searchRegion: function(oEvent) {
			var searchString = oEvent.getParameter("value");
			var aFilters = this._createRegionFilter(searchString);
			oEvent.getSource().getBinding("items").filter(aFilters);
		},
		
		closeRegionDialog: function(oEvent) {
			var selectedItem = oEvent.getParameter("selectedItem");
			this._setRegionFields(selectedItem.getCells()[0]);
			this.checkMandatoryCustFields();
			oEvent.getSource().getBinding("items").filter([]);
		},
		
		_createRegionFilter: function(sValue) {
			var orFilter = [];
			var andFilter = [];
			
			andFilter.push(new Filter("country", FilterOperator.EQ, this._oSalesQuote.getProperty("/Country")));
			andFilter.push(new Filter("name", FilterOperator.Contains, sValue));
			orFilter.push(new Filter(andFilter, true));
			
			andFilter = [];
			andFilter.push(new Filter("country", FilterOperator.EQ, this._oSalesQuote.getProperty("/Country")));
			andFilter.push(new Filter("key", FilterOperator.EQ, sValue));
			orFilter.push(new Filter(andFilter, true));
			
			return new Filter(orFilter, false);
		},
		
		_setRegionFields: function(oData) {
			this._oSalesQuote.setProperty("/Region",	 oData ? oData.data("Region")	  : "" );
			this._oSalesQuote.setProperty("/RegionText", oData ? oData.data("RegionText") : "" );
		},
		
		/* ========================================================== */
		/* Adhoc Material Dialog     							 	  */
		/* ========================================================== */
		
		showAdhocMaterialDialog: function(adhocCategory) {
			this._adhocCategory = adhocCategory;
			if (!this._oAdhocMaterialDialog) {
				this._oAdhocMaterialDialog = sap.ui.xmlfragment("dyflex.sd.sales.quotation.fragments.AdhocMaterialSearchDialog", this);
				this.getView().addDependent(this._oAdhocMaterialDialog);
				jQuery.sap.syncStyleClass("sapUiSizeCompact", this.getView(), this._oAdhocMaterialDialog);
			}
			this._oAdhocMaterialDialog.open();
		},
		
		searchAdhocMaterial: function(oEvent) {
			var searchString = oEvent.getParameter("value");
			var aFilters = this._createAdhocMaterialFilter(searchString);
			oEvent.getSource().getBinding("items").filter(aFilters);
		},
		
		closeAdhocMaterialDialog: function(oEvent) {
			var selectedItem = oEvent.getParameter("selectedItem");
			this._setAdhocMaterialFields(selectedItem.getTitle());
			oEvent.getSource().getBinding("items").filter([]);
		},
		
		_createAdhocMaterialFilter: function(sValue) {
			var aFilters = [];
			aFilters.push(new Filter("Material", sap.ui.model.FilterOperator.Contains, sValue));
			aFilters.push(new Filter("MaterialDesc", sap.ui.model.FilterOperator.Contains, sValue));
			return new Filter(aFilters, false);
		},
		
		_setAdhocMaterialFields: function(materialNo) {
			var that = this;
			var index;
			
			var oPriceSheet = this._oSalesQuote.getProperty("/to_PriceSheet");
			if (oPriceSheet) {
				var aCategory = oPriceSheet.to_Category.results;
				for (var i = 0; i < aCategory.length; i++) {
					if (aCategory[i].Adhoc && this._adhocCategory === aCategory[i].Category) {
						
						index = i;
						var objectKeys = "PriceSheet='" + oPriceSheet.PriceSheet + "',Category='" + aCategory[i].Category + "',Material='" + materialNo + "'";
						var oCategoryParts = new JSONModel(this._serviceUrl + "ZI_SQuote_CategoryPartsAdhoc(" + objectKeys + ")?$expand=to_PartsBom&$format=json");
						
						oCategoryParts.attachRequestCompleted({}, function() {
							
							var oPartsData = oCategoryParts.getData().d;
							if (oPartsData) {
							
								var editable = that._checkOrderQtyEditable(oPartsData);
								if (editable) {
									
									var oItemPrice = that._getItemPrice(oPartsData);
									
									oPartsData.OrderQuantity = "1";
									oPartsData.UnitPrice = oItemPrice.Price;
									oPartsData.PriceList = oItemPrice.PriceList;
									oPartsData.Discount = that._getCustomDiscount(that._oSalesQuote.getProperty("/CustomDiscount"), oPartsData.PricingGroup);
									
									aCategory[index].to_Parts.results.push(oPartsData);
									
									oPriceSheet.to_Category.results = aCategory;
									that._oSalesQuote.setProperty("/to_PriceSheet", oPriceSheet);
									that._addSelectedProductsToModel();	
								
								} else {
									MessageBox.alert(that.getResourceBundle().getText("msgNoPriceItem"));
								}
							} else {
								MessageBox.alert("Selected material is not valid for pricesheet");
							}
						});
					}
				}

			}
		},
		
		/* ========================================================== */
		/* Long Texts Dialog 							 			  */
		/* ========================================================== */
		
		onShowLongTextDialog: function(oEvent) {
			
			var currentLongText = "";
			var currentItem = {};
			
			this._sResetAdhoc = oEvent.getSource().getParent().data("ResetAdhoc") ? true : false;
			
			this._sCurrentTextType = oEvent.getSource().getParent().data("TextType");
			if (this._sCurrentTextType === "SelectCategory") {
				this._sCurrentItem = oEvent.getSource().getParent().getParent().getParent().getParent().getBindingContextPath();
			} else {
				this._sCurrentItem = oEvent.getSource().getParent().getParent().getBindingContextPath();
			}
			
			switch(this._sCurrentTextType) {
				case "SelectCategory":
					currentLongText = this._oSalesQuote.getProperty(this._sCurrentItem + "/LongText");
					currentItem = this._oSalesQuote.getProperty(this._sCurrentItem);
					break;
					
				case "SelectGeneral":
					currentLongText = this._oSalesQuote.getProperty(this._sCurrentItem + "/GeneralText");
					currentItem = this._oSalesQuote.getProperty(this._sCurrentItem);
					break;
				
				case "SelectConfig":
					currentLongText = this._oSalesQuote.getProperty(this._sCurrentItem + "/ConfigText");
					currentItem = this._oSalesQuote.getProperty(this._sCurrentItem);
					break;
				
				case "ConfigGeneral":
					currentLongText = this._oViewModel.getProperty(this._sCurrentItem + "/GeneralText");
					currentItem = this._oViewModel.getProperty(this._sCurrentItem);
					break;
				
				case "ConfigConfig":
					currentLongText = this._oViewModel.getProperty(this._sCurrentItem + "/ConfigText");
					currentItem = this._oViewModel.getProperty(this._sCurrentItem);
					break;
				
				default:
					return;
			}
			
			this._oViewModel.setProperty("/currentLongText", currentLongText);
			this._oViewModel.setProperty("/currentItem", currentItem);
			
			if (!this._oLongTextDialog) {
				this._oLongTextDialog = sap.ui.xmlfragment("dyflex.sd.sales.quotation.fragments.LongTextDialog", this);
				this.getView().addDependent(this._oLongTextDialog);
			}
			this._oLongTextDialog.open();
		},
		
		onSaveLongTextDialog: function(oEvent) {

			var longText = this._oViewModel.getProperty("/currentLongText");
			
			switch(this._sCurrentTextType) {
				case "SelectCategory":
					this._oSalesQuote.setProperty(this._sCurrentItem + "/LongText", longText);
					this._oSalesQuote.setProperty(this._sCurrentItem + "/LTxtDefault", true);
					break;
					
				case "SelectGeneral":
					this._oSalesQuote.setProperty(this._sCurrentItem + "/GeneralText", longText);
					this._oSalesQuote.setProperty(this._sCurrentItem + "/GTxtDefault", true);
					break;
				
				case "SelectConfig":
					this._oSalesQuote.setProperty(this._sCurrentItem + "/ConfigText", longText);
					this._oSalesQuote.setProperty(this._sCurrentItem + "/CTxtDefault", true);
					break;
				
				case "ConfigGeneral":
					this._oViewModel.setProperty(this._sCurrentItem + "/GeneralText", longText);
					this._oViewModel.setProperty(this._sCurrentItem + "/GTxtDefault", true);
					break;
				
				case "ConfigConfig":
					this._oViewModel.setProperty(this._sCurrentItem + "/ConfigText", longText);
					this._oViewModel.setProperty(this._sCurrentItem + "/CTxtDefault", true);
					break;
				
				default:
					return;
			}
			
			this._oLongTextDialog.close();
			
			if (this._sResetAdhoc) {
				this._addSelectedProductsToModel(true);
			}
		},
		
		onCloseLongTextDialog: function(oEvent) {
			this._oLongTextDialog.close();
		},
		
		/* ========================================================== */
		/* OUTPUT Methods        				 					  */
		/* ========================================================== */
		
		onPrintOnly: function() {
			this._oViewModel.setProperty("/printDialogMode", "print");
			this.openPrintDialog();
		},
		
		onSendOnly: function() {
			this._oViewModel.setProperty("/printDialogMode", "send");
			this.openPrintDialog();
		},
		
		openPrintDialog: function() {
			switch (this._oViewModel.getProperty("/printDialogMode")) {
				case "print":
					this._oViewModel.setProperty("/printDialogIcon", "sap-icon://print");
					this._oViewModel.setProperty("/printDialogText", "Print a copy");
					break;
				case "savePrint":
					this._oViewModel.setProperty("/printDialogIcon", "sap-icon://print");
					this._oViewModel.setProperty("/printDialogText", "Save and Print a copy");
					break;
				case "send":
					this._oViewModel.setProperty("/printDialogIcon", "sap-icon://email");
					this._oViewModel.setProperty("/printDialogText", "Send Email");
					break;
				case "saveSend":
					this._oViewModel.setProperty("/printDialogIcon", "sap-icon://email");
					this._oViewModel.setProperty("/printDialogText", "Save and Send Email");
					break;
			}
			
			if (!this._oPrintDialog) {
				this._oPrintDialog = sap.ui.xmlfragment("dyflex.sd.sales.quotation.fragments.PrintDialog", this);
				this.getView().addDependent(this._oPrintDialog);
			}
			this._oPrintDialog.open();
		},
		
		closePrintDialog: function() {
			if (this._oPrintDialog) {
				this._oPrintDialog.close();
			}
		},
		
		savePrintDialog: function() {
			switch (this._oViewModel.getProperty("/printDialogMode")) {
				case "print":
					this.printQuote();
					break;
				case "savePrint":
					this._saveEntity();
					break;
				case "send":
					this.sendEmail();
					break;
				case "saveSend":
					this._saveEntity();
					break;
			}
		},
		
		printQuote: function() {
			var docKey  = this._pad(this._sObjectId, 10);
			var docType = this.deriveDocumentType();
			
			window.open("/sap/opu/odata/sap/ZSD_SALES_QUOTE_SRV/Outputs(documentKey='" + docKey + "',documentType='" + docType + "')/$value");
			this.closePrintDialog();
		},
		
		deriveDocumentType: function() {
			// Determine the document type based on the flags
			var docType = Number(0);

			switch (this._oViewModel.getProperty("/printDocumentType")) {
				case "2": //With items
					docType = docType + Number(1);
					break;
				case "3": //With items and pricing
					docType = docType + Number(3);
					break;
			}

			switch (this._oViewModel.getProperty("/printPriceType")) {
				case "2": //Discounted Price
					docType = docType + Number(8);
					break;
			}

			switch (this._oViewModel.getProperty("/printDiscType")) {
				case "2": //Discounted Total
					docType = docType + Number(4);
			}

			return docType.toString();
		},
		
		sendEmail: function() {
			var salesQuote = this._oSalesQuote.getData();
			
			var oParameters = {
				"documentKey"   : this._pad(this._sObjectId, 10),
				"documentType"  : this.deriveDocumentType(),
				"contactEmail"  : salesQuote.EmailToContact ? salesQuote.ContactEmail : "",
				"emailToMyself" : salesQuote.EmailToMyself
			};
			
			this.getModel().callFunction("/SendEmailOutput", {
				method: "POST",
				urlParameters: oParameters,
				success: this._sendEmailSuccess.bind(this),
				error: this._sendEmailFailed.bind(this)
			});
			
			this.closePrintDialog();
		},
		
		_sendEmailSuccess: function() {
			var msg = this.getResourceBundle().getText("sendEmailSuccessMsg");
			MessageToast.show( msg, { duration: 3000, closeOnBrowserNavigation: false });
		},
		
		_sendEmailFailed: function() {
			// do nothing
		},
		
		/* =========================================================== */
		/* Internal Methods                                            */
		/* =========================================================== */
		
		_getDefaultDetailViewData: function() {
			return {
				busy: false,
				delay: 0,
				oneTime: false,
				lineItemListTitle: this.getResourceBundle().getText("detailLineItemTableHeading"),
				validated: {
					customer: false,
					selectPackage: false,
					configurePackage: true
				},
				currentTotalQuantity: Number(0),
				emailSalesRep: true,
				emailContact: true,
				currentTotalValue: Number(0).toFixed(2),
				printDocumentType: "2",
				printPriceType: "2",
				printDiscType: "1",
				changesMade: false,
				detailTitle: this.getResourceBundle().getText("detailTitle"),
				ProductHeaders: [],
				selectedProducts: [],
				selectedProductItems: [],
				editable: false,
				showCopyButton: false,
				saveEnabled: false,
				showOptional: false,
				
				printDialogMode: "",
				printDialogIcon: "",
				printDialogText: "",
				
				showDeleteButton: false,
				objectTitle: "",
				currentLongText: "",
				grandTotal: 0
			};
		},
		
		_getPriceSheetDetails: function() {
			var that = this;
			var priceSheet = this._oSalesQuote.getProperty("/PriceSheet");
			if (priceSheet) {
				var oPriceSheet = new JSONModel(this._serviceUrl + "ZI_SQuote_PriceSheet('" + priceSheet + "')?$format=json&$expand=to_Category/to_Parts/to_PartsBom");
				oPriceSheet.attachRequestCompleted({}, function(oEvent) {
					var priceSheetData = oPriceSheet.getData().d;
					that._oSalesQuote.setProperty("/to_PriceSheet", priceSheetData);
					that._oSalesQuote.setProperty("/LongText1", priceSheetData.LongText);
					
					that._getMaterialPriceModel();
					that._getDiscountModel();
					that.checkMandatoryCustFields();	
				});
			} else {
				that._oSalesQuote.setProperty("/to_PriceSheet", {});
				that._resetSelectedProductsModel();
			}
		},
		
		_getMaterialPriceModel: function() {
			var salesQuote = this._oSalesQuote.getData();
			
			if (salesQuote.PriceSheet && salesQuote.PriceList && salesQuote.TransactionCurrency) {
				
				var filter = "PriceList eq '" + salesQuote.PriceList + "' and Currency eq '" + salesQuote.TransactionCurrency + "'";
				var oMatlPriceModel = new JSONModel(this._serviceUrl + "ZI_SQuote_PriceCond?$format=json&$filter=" + filter);
				oMatlPriceModel.setSizeLimit(99999);
				this.setModel(oMatlPriceModel, "matlPriceModel");
				
				var that = this;
				oMatlPriceModel.attachRequestCompleted({}, function(oEvent) {
					that._addSelectedProductsToModel();
				});
					
			} else {
				this.setModel(new JSONModel(), "matlPriceModel");
				this._resetSelectedProductsModel();
			}
		},
		
		_getDiscountModel: function() {
			var that = this;
			var salesQuote = this._oSalesQuote.getData();
			
			if (salesQuote.PriceSheet && salesQuote.PriceList && salesQuote.Customer) {
				
				var objectKeys = "PriceSheet='" + salesQuote.PriceSheet + "',Customer='" + salesQuote.Customer + "',PriceList='" + salesQuote.PriceList + "'";
				var oDiscountModel = new JSONModel(this._serviceUrl + "ZI_SQuote_PriceSheetDiscount(" + objectKeys + ")?$format=json");
				
				oDiscountModel.attachRequestCompleted({}, function(oEvent) {
					var customDiscount = oDiscountModel.getProperty("/d/Discount") ? oDiscountModel.getProperty("/d/Discount") : 0;
					that._oSalesQuote.setProperty("/CustomDiscount", customDiscount);
					that._updateProductDiscounts();
				});
				
			} else {
				this._oSalesQuote.setProperty("/CustomDiscount", 0);
				this._updateProductDiscounts();
			}
		},
		
		_updateProductDiscounts: function() {
			var oPriceSheet = this._oSalesQuote.getProperty("/to_PriceSheet");
			if (oPriceSheet) {
				var customDicount = this._oSalesQuote.getProperty("/CustomDiscount");
				var aCategory = oPriceSheet.to_Category.results;
				for (var i = 0; i < aCategory.length; i++) {
					
					var aParts = aCategory[i].to_Parts.results;
					for (var j = 0; j < aParts.length; j++) {
						
						aParts[j].Discount = this._getCustomDiscount(customDicount, aParts[j].PricingGroup);
						
						aParts[j].to_PartsBom.results.forEach((oBom) => {
							if (!oBom.FreeItem) {
								oBom.Discount = this._getCustomDiscount(customDicount, oBom.PricingGroup);
							}
						});
						
					}
					aCategory[i].to_Parts.results = aParts;
				}
				oPriceSheet.to_Category.results = aCategory;
				this._oSalesQuote.setProperty("/to_PriceSheet", oPriceSheet);	
				
				this._addSelectedProductsToModel();
			}
		},
		
		_initialiseOtherModels: function() {
			var that = this;
			var oExclusionModel = new JSONModel(this._serviceUrl + "ZI_SQuote_Exclusion?$format=json");
			oExclusionModel.setSizeLimit(99999);
			oExclusionModel.attachRequestCompleted({}, function() {
				that._aExclusion = oExclusionModel.getData().d.results;
			});
				
			var oRootPath = jQuery.sap.getModulePath("dyflex.sd.sales.quotation");
			
			// Initialise the countries data from the json file
			var oCountriesModel = new JSONModel({
				bCache: true
			});
			oCountriesModel.loadData(oRootPath + "/model/countries.json");
			oCountriesModel.setSizeLimit(9999);
			this.setModel(oCountriesModel, "countries");

			// Initialise the regions data from the json file
			var oRegionsModel = new JSONModel({
				bCache: true
			});
			oRegionsModel.loadData(oRootPath + "/model/regions.json");
			oRegionsModel.setSizeLimit(9999);
			this.setModel(oRegionsModel, "regions");
		},
		
		_adjustProductQty: function(oEvent, modifier) {
			var sPath = oEvent.getSource().getParent().getParent().getBindingContextPath();
			var oData = this._oSalesQuote.getProperty(sPath);
			
			var editable = this._checkOrderQtyEditable(oData);
			if (editable) {
				
				var orderQuantity = Number(oData.OrderQuantity) + Number(modifier);
				orderQuantity = orderQuantity > 0 ? orderQuantity : 0;
				
				this._oSalesQuote.setProperty(sPath + "/OrderQuantity", orderQuantity);
				this._addSelectedProductsToModel();
				
			} else {
				MessageBox.alert(this.getResourceBundle().getText("msgNoPriceItem"));
			}
		},
		
		_checkOrderQtyEditable: function(oData) {
			// Not editable if at least one item doesn't have a price
			if (oData.to_PartsBom.results.length > 0) {
				for (let i = 0; i < oData.to_PartsBom.results.length; i++) {
					var oBomPrice = this._getItemPrice(oData.to_PartsBom.results[i]);
					if (Number(oBomPrice.Price) === 0) {
						return false;
					}
				}
			} else {
				var oItemPrice = this._getItemPrice(oData);
				if (Number(oItemPrice.Price) === 0) {
					return false;
				}
			}
			return true;
		},
		
		_addSelectedProductsToModel: function(resetAdhoc) {
			var aSelectedProducts = [];
			var grandTotal = 0;
			var salesQuote = this._oSalesQuote.getData().to_PriceSheet;
			var aCategory = this._sortSequence( salesQuote.to_Category.results );
			
			this._oViewModel.setProperty("/showOptional", false);
			
			for (var i = 0; i < aCategory.length; i++) {
				var aItems = this._sortSequence( aCategory[i].to_Parts.results );
				for (var j = 0; j < aItems.length; j++) {
					
					// Check excluded items
					var excluded = this._checkExclusionTable(aItems[j].PriceSheet,
															 aItems[j].Category,
															 aItems[j].Material,
															 this._oSalesQuote.getProperty("/PriceList"));
					this._oSalesQuote.setProperty("/to_PriceSheet/to_Category/results/" + i + "/to_Parts/results/" + j + "/Excluded", excluded);
					
					// Recalculate Product Values
					if (aItems[j].OrderQuantity && Number(aItems[j].OrderQuantity) > 0 && !excluded) {
						
						aItems[j] = this._recalcProductValues(aItems[j], resetAdhoc);
						
						// If all BoMs are deleted, remove the quantity in main item too
						if ( Number(aItems[j].OrderQuantity) > 0 ) {
							
							// Don't include optional category in the grand total
							if (aItems[j].Category !== "ZQ") {
								grandTotal = grandTotal + Number(aItems[j].NetAmount);
							} else {
								this._oViewModel.setProperty("/showOptional", true);
							}
							aSelectedProducts.push(aItems[j]);
							
						} else {
							// Update Qty in Model to remove it in Select Products section
							this._oSalesQuote.setProperty("/to_PriceSheet/to_Category/results/" + i + "/to_Parts/results/" + j + "/OrderQuantity", 0);
						}
					}
				}
			}
			this._oViewModel.setProperty("/selectedProducts", aSelectedProducts);
			this._oViewModel.setProperty("/validated/selectPackage", aSelectedProducts.length > 0 ? true : false);
			this._oViewModel.setProperty("/grandTotal", grandTotal);
			
			this._checkSaveEnablement();
		},
		
		_recalcProductValues: function(oItem, resetAdhoc) {
			var aItemBom = oItem.to_PartsBom.results;
			oItem.NetAmount = 0;
			
			// If text is changed in Select Product, reset BOM item data
			if (resetAdhoc && aItemBom.length === 1 && aItemBom[0].Material === oItem.Material) {
				aItemBom.pop();
			}

//VK
			if(oItem.FreeItem)
			{
				oItem.Discount = 100;
			}
//VK
			
			// Add the Original item in BOM display if no BOM components
			if (aItemBom.length === 0) {
				aItemBom.push({
					"Material"		: oItem.Material,
					"MaterialDesc"	: oItem.MaterialDesc,
					"OrderQuantity"	: oItem.OrderQuantity,
					"UnitPrice"		: oItem.UnitPrice,
					"NetPrice"		: oItem.NetPrice,
					"NetAmount"		: oItem.NetAmount,
					"OrderUnit"		: oItem.OrderUnit,
					"Discount"		: oItem.Discount,
					"Category"		: oItem.Category,
					"PriceList"		: oItem.PriceList,
					"GeneralText"   : oItem.GeneralText,
					"GTxtDefault"   : oItem.GTxtDefault,
					"ConfigText"    : oItem.ConfigText,
					"CTxtDefault"   : oItem.CTxtDefault,
					"PricingGroup"	: oItem.PricingGroup,
//VK - Free Item conditions					
					"FreeItem"      : Number(oItem.Discount) >= 100,
//VK - Free Item conditions										
					"BomQuantity"	: 1
				});
			}
			
			var itemDeleted = true;
			
			for (var i = 0; i < aItemBom.length; i++) {
					
				// On Copy or Edit, use the updated price
				if (this._oViewModel.getProperty("/editable")) {
					
					var oItemPrice = this._getItemPrice(aItemBom[i]);
					var itemDiscount = oItem.Discount ? oItem.Discount : 0;
					
					aItemBom[i].Discount = aItemBom[i].Discount ? aItemBom[i].Discount : this._getCustomDiscount(itemDiscount, aItemBom[i].PricingGroup);
					aItemBom[i].UnitPrice = oItemPrice.Price;
					aItemBom[i].PriceList = oItemPrice.PriceList;
					
				} else {
					if (!aItemBom[i].UnitPrice) {
						aItemBom[i].Deleted = true;
					}
				}
				
				// If deleted, set unit price to 0
				if (aItemBom[i].Deleted) {
					aItemBom[i].Discount = 0;
					aItemBom[i].UnitPrice = 0;
				} else {
					itemDeleted = false;
				}
				
				// Calculate other fields
				aItemBom[i].OrderQuantity = Number(aItemBom[i].BomQuantity) * Number(oItem.OrderQuantity);
				aItemBom[i].NetPrice = Number(aItemBom[i].UnitPrice) * (1 - Number(aItemBom[i].Discount) / 100);
				aItemBom[i].NetAmount = Number(aItemBom[i].OrderQuantity) * Number(aItemBom[i].NetPrice);
				
				oItem.NetAmount = oItem.NetAmount + Number(aItemBom[i].NetAmount);
			}
			
			// If all BoMs are deleted, remove the quantity in main item too
			if (itemDeleted) {
				oItem.OrderQuantity = 0;
			}
			
			return oItem;
		},
		
		_resetSelectedProductsModel: function() {
			this._oViewModel.setProperty("/selectedProducts", []);
			this._oViewModel.setProperty("/grandTotal", 0);	
			this._oViewModel.setProperty("/saveEnabled", false);
		},
		
		_getItemPrice: function(oItem) {
			var oItemPrice = {};
			var aMatlPrices = this.getModel("matlPriceModel").getData().d;
			if (aMatlPrices) {
				var oPrice = aMatlPrices.results.find(function(obj) {
					return obj.Material === oItem.Material &&
						   obj.Standard === false;
				});
				// If item is from Adhoc category and no price from selected Price List,
				// get price from the standard price list
				if (!oPrice) {
					var oCategory = this._oSalesQuote.getData().to_PriceSheet.to_Category.results.find(function(obj) {
						return obj.Category === oItem.Category;
					});
					if (oCategory.Adhoc) {
						oPrice = aMatlPrices.results.find(function(obj) {
							return obj.Material === oItem.Material &&
								   obj.Standard === true;
						});
					}
				}
			}
			
			oItemPrice.Price = oPrice ? oPrice.Price : "0";
			oItemPrice.PriceList = oPrice ? oPrice.PriceList : "";
			
			return oItemPrice;
		},
		
		_checkExclusionTable: function(priceSheet, category, material, priceList) {
			if (this._aExclusion) {
				var oExcluded = this._aExclusion.find(function(obj) {
					return obj.PriceSheet === priceSheet
						&& obj.Category   === category
						&& obj.Material   === material
						&& obj.PriceList  === priceList;
				});
				if (oExcluded) {
					return true;
				} else {
					return false;
				}
			} else {
				return false;
			}
		},
		
		_checkSaveEnablement: function() {
			if (this._oViewModel.getProperty("/selectedProducts").length > 0 &&
				this._oViewModel.getProperty("/validated/customer") ) {
				this._oViewModel.setProperty("/saveEnabled", true);
			} else {
				this._oViewModel.setProperty("/saveEnabled", false);
			}
		},
		
		_setEndUserModel: function() {
			var that = this;
			if (this._oSalesQuote.getProperty("/OneTimeAcct")) {
				
				var oEndUserOTModel = new JSONModel(this._serviceUrl + "ZI_SQuote_CustEndUserOT?$format=json");
				oEndUserOTModel.attachRequestCompleted({}, function(oEvent) {
					that.setModel(oEndUserOTModel, "endUserModel");
				});
				
			} else if (this._oSalesQuote.getProperty("/Customer")) {
				
				var requestUrl = this._serviceUrl + "ZI_SQuote_CustEndUser?$format=json&$filter=Customer eq '" + this._oSalesQuote.getProperty("/Customer") + "'";
				var oEndUserModel = new JSONModel(requestUrl);
				oEndUserModel.attachRequestCompleted({}, function(oEvent) {
					that.setModel(oEndUserModel, "endUserModel");
				});
				
			} else {
				this.setModel(new JSONModel(), "endUserModel");
			}
		},
		
		_setFuncLocModel: function() {
			var that = this;
			if (this._oSalesQuote.getProperty("/EndUser")) {
				var requestUrl = this._serviceUrl + "ZI_SQuote_FuncLoc?$format=json&$filter=Customer eq '" + this._oSalesQuote.getProperty("/EndUser") + "'";
				var oFuncLocModel = new JSONModel(requestUrl);
				oFuncLocModel.attachRequestCompleted({}, function(oEvent) {
					that.setModel(oFuncLocModel, "funcLocModel");
				});
			} else {
				this.setModel(new JSONModel(), "funcLocModel");
			}
		},
		
		_setContactModel: function() {
			var that = this;
			if (this._oSalesQuote.getProperty("/Customer")) {
				var requestUrl = this._serviceUrl + "ZI_SQuote_ContactPerson?$format=json&$filter=Customer eq '" + this._oSalesQuote.getProperty("/Customer") + "'";
				var oContactModel = new JSONModel(requestUrl);
				oContactModel.attachRequestCompleted({}, function(oEvent) {
					that.setModel(oContactModel, "contactModel");
				});
			} else {
				this.setModel(new JSONModel(), "contactModel");
			}
		},
		
		_setDefaultOneTimeCustModel: function(showBusy) {
			var that = this;
			if (showBusy) {
				this._oViewModel.setProperty("/busy", true);
			}
			
			var oDefaultOneTimeCust = new JSONModel(this._serviceUrl + "ZI_SQuote_Parameters('ONE_TIME_CUST')?$format=json");
			oDefaultOneTimeCust.attachRequestCompleted({}, function(oEvent) {
				that.setModel(oDefaultOneTimeCust, "defaultOneTimeCust");
				if (showBusy) {
					that._oViewModel.setProperty("/busy", false);
				}
			});
		},
		
		_sortSequence: function(aData) {
			
			function compare( a, b ) {
				return a.Sequence - b.Sequence;
			}
			aData.sort( compare );
			
			return aData;
		},
		
		_getCustomDiscount: function(customDicount, pricingGroup) {
			if (Number(customDicount) > 0 && Number(customDicount) < 10) {
				if (pricingGroup === "Z1") {
					return "0";
				} else {
					return customDicount;
				}
			} else if (Number(customDicount) >= 10) {
				if (pricingGroup === "Z1") {
					return "0";
				} else if (pricingGroup === "Z2") {
					return "10";
				} else {
					return customDicount;
				}
			} else {
				return "0";
			}
		},
		
		_navToWorklist: function() {
			this.getRouter().navTo("worklist", {}, true);
		}
		
	});

});