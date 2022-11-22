jQuery.sap.require("sap.ui.qunit.qunit-css");
jQuery.sap.require("sap.ui.thirdparty.qunit");
jQuery.sap.require("sap.ui.qunit.qunit-junit");
QUnit.config.autostart = false;

sap.ui.require([
		"sap/ui/test/Opa5",
		"dyflex/sd/sales/quotation/test/integration/pages/Common",
		"sap/ui/test/opaQunit",
		"dyflex/sd/sales/quotation/test/integration/pages/Worklist",
		"dyflex/sd/sales/quotation/test/integration/pages/Object",
		"dyflex/sd/sales/quotation/test/integration/pages/NotFound",
		"dyflex/sd/sales/quotation/test/integration/pages/Browser",
		"dyflex/sd/sales/quotation/test/integration/pages/App"
	], function (Opa5, Common) {
	"use strict";
	Opa5.extendConfig({
		arrangements: new Common(),
		viewNamespace: "dyflex.sd.sales.quotation.view."
	});

	sap.ui.require([
		"dyflex/sd/sales/quotation/test/integration/WorklistJourney",
		"dyflex/sd/sales/quotation/test/integration/ObjectJourney",
		"dyflex/sd/sales/quotation/test/integration/NavigationJourney",
		"dyflex/sd/sales/quotation/test/integration/NotFoundJourney",
		"dyflex/sd/sales/quotation/test/integration/FLPIntegrationJourney"
	], function () {
		QUnit.start();
	});
});