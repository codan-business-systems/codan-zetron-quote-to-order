sap.ui.define([
	] , function () {
		"use strict";

		return {

			/**
			 * Rounds the number unit value to 2 digits
			 * @public
			 * @param {string} sValue the number string to be rounded
			 * @returns {string} sValue with 2 digits rounded
			 */
			numberUnit : function (sValue) {
				if (!sValue) {
					return "0.00";
				}
				return parseFloat(sValue).toFixed(2);
			},
			
			numberNoZero : function (sValue) {
				if (!sValue || Number(sValue) === 0) {
					return "";
				}
				return parseFloat(sValue);
			},
			
			/**
			 * Format date output for text fields
			 * @param {String} sValue value to be formatted
			 * @return {String} formatted date value
			 */
			dateOutput: function(sValue) {
				var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({pattern: "dd MMM yyyy"});
				var sDateAsString = oDateFormat.format(new Date(sValue));
				return sDateAsString;
			},
			
			processStatus: function(status) {
				switch (status) {
					case "A":
						return "Open";
					case "B":
						return "Order Created";
					case "C":
						return "Completed";
					case "D":
						return "Draft";
					default :
						return "New";
				}
			},
			
			checkCategoryVisible: function(aParts, adhoc) {
				if ( ( aParts && aParts.length > 0 ) || adhoc) {
					return true;
				} else {
					return false;
				}
			},
			
			categoryHighlight: function(category) {
				switch (category) {
					case "ZZ":	// Adhoc
						return "grey";
					case "ZQ":	// Optional
						return "blue";
					default :
						return "none";
				}
			}
			
		};

	}
);