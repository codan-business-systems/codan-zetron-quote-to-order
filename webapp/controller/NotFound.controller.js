sap.ui.define([
		"dyflex/sd/sales/quotation/controller/BaseController"
	], function (BaseController) {
		"use strict";

		return BaseController.extend("dyflex.sd.sales.quotation.controller.NotFound", {

			/**
			 * Navigates to the worklist when the link is pressed
			 * @public
			 */
			onLinkPressed : function () {
				this.getRouter().navTo("worklist");
			}

		});

	}
);