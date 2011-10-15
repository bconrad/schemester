/* The important data structure is the 'swatches' array, which is an array of dictionaries. The exact structure follows:

swatches (array)
|
|\_ swatch1 (dictionary)
|  |
|  |\_ color (string - a hex value)
|   \_ users (array)
|    |\_ user1 (dictionary)
|    | |
|    | |\_ element (DOMElement)
|    | |
|    |  \_ prop (string)
|    |
|    |\_ user2
|     \_ user3
|
|\_ swatch2
|  |
|  |\_ color
|   \_ users
|    |\_ user1
|    |\_ user2
|     \_ user3

(etc.)
*/

var swatches = new Array();
var simpleswatchdict = {};

var interestingProps = new Array("backgroundColor", "color", "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor", "outlineColor");

// redraws the page according to the 'swatches' color map
function redraw() {
	for (var i = 0; i < swatches.length; i++) {
		for (var j = 0; j < swatches[i].users.length; j++) {
			swatches[i].users[j].element.style[swatches[i].users[j].prop] = "#" + swatches[i].color;
		}
	}
}

// yet another utility function. Why isn't there a native way to do this?
function isArray(testObject) {
	    return testObject && !(testObject.propertyIsEnumerable('length')) && typeof testObject === 'object' && typeof testObject.length === 'number';
}

//perform a shallow merge on objects, concat'ing properties present in both which have arrays as their values
function shallowMerge(o1, o2) {
	for (var p in o2) {
		if(isArray(o2[p]) && isArray(o1[p])) {
			o1[p] = o1[p].concat(o2[p]);
		} else if(o1[p] && o2[p]) {
			o1[p] = shallowMerge(o1[p], o2[p]);
		}
		else if (o2[p]) {
			o1[p] = o2[p];
		}
	}
	return o1;
}

// Gratefully taken from http://dev.enekoalonso.com/2010/07/20/little-tricks-string-padding-in-javascript/comment-page-1/
function pad(str) {
	return String("00" + str.toString(16)).slice(-2);
}

// these are so I can eval() the rgb(x, y, z) values returned by the css properties
function rgb(r, g, b) {
	return pad(r) + pad(g) + pad(b);
}

function rgba(r, g, b, a) {
	if (a == 0) {
		return false;
	}
	return pad(r) + pad(g) + pad(b);
}

function findColors(element) {
	var color, colorcode;
	var colors = {};
	for (var i = 0; i < interestingProps.length; i++) {

		if (document.defaultView.getComputedStyle(element, null)[interestingProps[i]]) {
			color = document.defaultView.getComputedStyle(element, null)[interestingProps[i]];
		} else {
			continue;
		}
		// since the values are rgb(x,y,z) or rgba(x,y,z,a) by defining the functions above I can just use eval()
		// chrome cleans these strings already, I believe
		colorcode = eval(color);

		if (!colorcode)
			continue;

		if (typeof colors[colorcode] == "undefined") {
			colors[colorcode] = new Object();
			colors[colorcode].users = new Array();
		}
		colors[colorcode].users.push({"element" : element, "prop" : interestingProps[i]});
	}
	return colors;
}

// Takes a dictionary produced by getColors and returns a dictionary of swatches with .color and .users properties
function swatchify (colors) {
	var swatcharray = new Array();
	var matched;
	for (c in colors) {
		matched = false;
		for (var i; i < swatcharray.length; i++) {
			if (swatcharray[i].color = c) {
				swatcharray[i].users = swatcharray[i].users.concat(colors[c].users);
				matched = true;
				break;
			}
		}
		if (!matched) {
			swatcharray.push({"color": c, "users": colors[c].users});
		}
	}
	return swatcharray;
}

// Traverses the DOM tree and creates an array of colors and their users
function getColors(targetDocument, currentElement)
{
	var foundColors = {}, childColors = {};
	if (currentElement)
	{
		// Traverse the tree
		var i=0;
		var currentElementChild=currentElement.childNodes[i];
		while (currentElementChild)
		{
			// Recursively traverse the tree structure of the child node
			childColors = shallowMerge(childColors, getColors(targetDocument, currentElementChild));
			i++;
			currentElementChild=currentElement.childNodes[i];
		}

		if(document.defaultView.getComputedStyle(currentElement, null)) {
			foundColors = findColors(currentElement);
		}
	}
	return shallowMerge(foundColors, childColors);
}

// accepts the swatches array (or an array of similar structure) and creates a simple array of colors
function sendColors(r) {
	var colors = new Array();
	for (var i = 0; i < r.length; i++) {
		colors.push(r[i].color);
	}
	chrome.extension.sendRequest(colors, function (response) { document.write(response) });
}

function requestListener(msg) {
	if (msg["op"] == "init") {
		if (swatches.length) {
			sendColors(swatches);
		}
	} else if (msg["op"] == "load") {
		swatches = swatchify(getColors(document, document.getElementsByTagName("HTML")[0]));
		sendColors(swatches);
	} else if (msg["op"] == "redraw") {
		if (!msg["map"]) {
			return;
		}
		for (var i = 0; i < swatches.length; i++) {

			// if the map has an entry for this color, set it to the mapped one
			if (msg["map"][swatches[i].color])
				swatches[i].color = msg["map"][swatches[i].color];
		}
		redraw();
	}
}

chrome.extension.onRequest.addListener(requestListener);
