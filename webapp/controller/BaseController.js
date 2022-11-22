sap.ui.define([
		"sap/ui/core/mvc/Controller",
		"sap/m/MessageBox"
	], function (Controller, MessageBox) {
		"use strict";

		return Controller.extend("dyflex.sd.sales.quotation.controller.BaseController", {
			/**
			 * Convenience method for accessing the router.
			 * @public
			 * @returns {sap.ui.core.routing.Router} the router for this component
			 */
			getRouter : function () {
				return sap.ui.core.UIComponent.getRouterFor(this);
			},

			/**
			 * Convenience method for getting the view model by name.
			 * @public
			 * @param {string} [sName] the model name
			 * @returns {sap.ui.model.Model} the model instance
			 */
			getModel : function (sName) {
				return this.getView().getModel(sName);
			},

			/**
			 * Convenience method for setting the view model.
			 * @public
			 * @param {sap.ui.model.Model} oModel the model instance
			 * @param {string} sName the model name
			 * @returns {sap.ui.mvc.View} the view instance
			 */
			setModel : function (oModel, sName) {
				return this.getView().setModel(oModel, sName);
			},

			/**
			 * Getter for the resource bundle.
			 * @public
			 * @returns {sap.ui.model.resource.ResourceModel} the resourceModel of the component
			 */
			getResourceBundle : function () {
				return this.getOwnerComponent().getModel("i18n").getResourceBundle();
			},

			/**
			 * Event handler when the share by E-Mail button has been clicked
			 * @public
			 */
			onShareEmailPress : function () {
				var oViewModel = (this.getModel("objectView") || this.getModel("worklistView"));
				sap.m.URLHelper.triggerEmail(
					null,
					oViewModel.getProperty("/shareSendEmailSubject"),
					oViewModel.getProperty("/shareSendEmailMessage")
				);
			},
			
			/**
			 * Pad a number with leading zeros.
			 * @param {number} num The number to format 
			 * @param {number} size The size required to pad to
			 * @returns {string} zero-padded number
			 */
			_pad: function(num, size) {
				var s = num + "";
				while (s.length < size) {
					s = "0" + s;
				}
				return s;
			},
			
			_handleJSONModelError: function(oEvent) {
				var sDetails = oEvent.getParameters().errorobject;
				if (sDetails) {
					
					// Add friendly error messages
					var e = null, xml = null, sErrorString = "", sErrorMessage = "";
					try {
						e = JSON.parse(sDetails.responseText);
					} catch (ex) {
						jQuery.sap.log.info(ex.message);
						// OPA tests will send 'serverError' when mocking a server-side response error!
						if (sDetails.responseText !== "serverError") {
							xml = jQuery.parseXML(sDetails.responseText);
							sErrorString = xml.getElementsByTagName("message")[0].childNodes[0].data;
						}
					}
				
					if (sErrorString) {
						sErrorMessage = "An error occured:\n\n" + sErrorString;
						MessageBox.error(sErrorMessage);
					} else if (e && e.error.message.value) {
						sErrorMessage = this.getResourceBundle().getText("errorBAPITitle") + "\n\n" + e.error.message.value;
						MessageBox.error(sErrorMessage);
					} else {
						MessageBox.error(this._sErrorText);
					}
				
				}
			}

		});

	}
);