var url = chrome.runtime.getURL("blocked-page.html");
let fontRecoleta = new FontFace("Recoleta", chrome.runtime.getURL("fonts/Recoleta Regular.woff"));
let fontWorkSans = new FontFace("WorkSans", chrome.runtime.getURL("fonts/WorkSans-Light.woff"));


setTimeout(() => {
    fetch(url)
    .then(response => response.text())
    .then(html => {
        let parser = new DOMParser();
        let newDoc = parser.parseFromString(html, "text/html");
    
        let newDocHeadElement = newDoc.querySelector("head");
        let newDocBodyElement = newDoc.querySelector("body");
    
        let oldDocHeadElement = document.querySelector("head");
        let oldDocBodyElement = document.querySelector("body");
    
        let htmlRoot = document.querySelector("head").parentElement; // html tag/element
        htmlRoot.replaceChild(newDocHeadElement, oldDocHeadElement);
        htmlRoot.replaceChild(newDocBodyElement, oldDocBodyElement);

        removeAttributes(htmlRoot);
        newDoc.fonts.add(fontRecoleta);
        newDoc.fonts.add(fontWorkSans);
    });
}, 500)

function removeAttributes(element) {
    if (element.hasAttributes()) {
        for (const attr of element.attributes) {
            element.removeAttribute(attr.name);
        }
    }
}