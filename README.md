# jsharmony-cms-sdk-clientjs
jsHarmony CMS SDK for Client-side JS

## Installation

Installation and integration instructions are available at [jsHarmonyCMS.com](https://www.jsharmonycms.com/resources/integrations/client-side-js/)

## API Documentation

## *jsHarmonyCmsClient Class*

* [Constructor](#constructor)
* *Public Properties*
   * [onError](#onerror)
   * [onRouteNotFound](#onroutenotfound)
   * [onPageRender](#onpagerender)
   * [onPageRendered](#onpagerendered)
   * [onPageDestroy](#onpagedestroy)
   * [onLinkClick](#onlinkclick)
   * [onSaveState](#onsavestate)
   * [onRestoreState](#onrestorestate)
   * [onSetTitle](#onsettitle)
   * [onSetMetaDescription](#onsetmetadescription)
   * [onSetMetaKeywords](#onsetmetakeywords)
   * [onSetCanonicalUrl](#onsetcanonicalurl)
* *Public Methods*
   * [Router](#router)
   * [Standalone](#standalone)
   * [isInEditor](#isineditor)
   * [getEditorTemplateId](#geteditortemplateid)
   * [resolve](#resolve)
   * [render](#render)
   * [route](#route)
   * [getPageData](#getpagedata)
   * [getRedirectData](#getredirectdata)
   * [renderPage](#renderpage)
   * [renderElement](#renderelement)
   * [matchRedirect](#matchredirect)
   * [bindLinks](#bindlinks)

---

## Constructor

```js
new jsHarmonyCmsClient(config)
```

#### Arguments

- `config` (Object) :: Object with one or more of the configuration keys below:
```less
{
  access_keys: [],                //Array(string) CMS Editor Access Keys
  page_files_path: '/',           //(string) URL to page files
  redirect_listing_path: null,    //(string) URL to redirect listing JSON file
  default_document: 'index.html', //(string) Default Directory Document
  strict_url_resolution: false,   //(bool) Whether to try URL variations (add "/", "/<default_document>")
  cms_templates: ['*'],           //Array(string) List of Page Template Names supported by this instance, or use '*' for all
  bind_routing_events: true,      //(bool) Whether to auto-bind the routing events (link click, browser back / forward buttons) for single-page functionality
  footer_container: null,         //(string) CSS Selector - If set, use an element ID to insert page.footer content, instead of appending to the end of the page
  auto_init: true                 //(bool) Set false to prevent onInit() from being called in constructor. If false, the caller must call onInit() before using jsHarmonyCmsClient
}
```

#### Example
```js
var cmsClient = new jsHarmonyCmsClient({ access_keys: ['*****ACCESS_KEY*****'] });
```

---

## Public Properties

---

### onError
`function(err){ }`

Function executed when an unexpected error occurs
```js
cmsClient.onError = function(err){ console.error(err.message); };
```

---

### onRouteNotFound
`function(url){ }`

Function executed when a matching route is not found for the URL
```js
cmsClient.onRouteNotFound = function(url){ cmsClient.generate404(); };
```

---

### onPageRender
`function(page){ }`

Function executed when page rendering has started
```js
cmsClient.onPageRender = function(page){ }
```

---

### onPageRendered
`function(page){ }`

Function executed when page rendering has completed
```js
cmsClient.onPageRendered = function(page){ }
```

---

### onPageDestroy
`function(){ }`

Function executed when the last rendered page is unbound and cleared from memory
```js
cmsClient.onPageDestroy = function(){ }
```

---

### onLinkClick
`function(url, e){ }`

Function executed when a link is clicked in a CMS content area (requires `config.bind_routing_events = true`)
```js
cmsClient.onLinkClick = function(url, e){ /* return false to cancel click */ }
```

----

### onSaveState
`function(url){ }`

Function executed when a URL is saved to the back button history
```js
cmsClient.onSaveState = function(url){ window.history.pushState({}, document.title, url); }
```

---

### onRestoreState
`function(url){ }`

Function executed when a user presses back or forward, and loads a history state
```js
cmsClient.onRestoreState = function(url){ cmsClient.route(url); }
```

---

### onSetTitle
`function(title){ }`

Function executed when the document title is updated. The title will not be updated if the function returns false.
```js
cmsClient.onSetTitle = function(title) { /* return false to prevent document title from being set by client. */}
```

---

### onSetMetaDescription
`function(description){ }`

Function executed when the `<meta name="description">` element is updated. The element will not be updated if the function returns false.
```js
this.onSetMetaDescription = function(desc){/* return false to prevent <meta name="description"> from being set by client. */};
```

---

### onSetMetaKeywords
`function(keywords){ }`

Function executed when the `<meta name="keywords">` element is updated. The element will not be updated if the function returns false.
```js
this.onSetMetaKeywords = function(keywords){/* return false to prevent <meta name="keywords"> from being set by client. */};
```

---

### onSetCanonicalUrl
`function(url){ }`

Function executed when the `<link rel="canonical">` element is updated. The element will not be updated if the function returns false.
```js
this.onSetCanonicalUrl = function(url){/* return false to prevent <link rel="canonical"> from being set by client. */};
```

---

## Public Methods

---

### Router
`<jsHarmonyCmsClient>.Router(url)`

*Main Entry Point* - Run CMS Router
#### Parameters
* `url: (string)` *(Optional)* CMS Page URL

   Use Full URL, Root-relative URL, or leave blank to use current URL

#### Example
```js
cmsClient.Router();
```

---

### Standalone
`<jsHarmonyCmsClient>.Standalone(url)`

*Main Entry Point* - Load Standalone CMS Content
#### Parameters:
* `url: (string)` *(Optional)* CMS Page URL

   Use Full URL, Root-relative URL, or leave blank to use current URL

#### Example
```js
cmsClient.Standalone('/login/');
```

---

### isInEditor
`<jsHarmonyCmsClient>.isInEditor()`

Checks whether the page is in CMS Edit mode

#### Parameters
N/A

#### Returns
`(bool)` True if this page was opened from the CMS Editor

#### Example
```js
if(cmsClient.isInEditor()) alert('Opened from CMS Editor');
```

---

### getEditorTemplateId
`<jsHarmonyCmsClient>.getEditorTemplateId()`

Get the page template ID (if it exists) specified by the CMS Editor.

#### Parameters
N/A

#### Returns
`(string)` The template ID specified by the editor. Value will be empty if not specified.

#### Example
```js
var templateId = cmsClient.getEditorTemplateId();
```

---

### resolve
`<jsHarmonyCmsClient>.resolve(url, options)`

Converts URL to CMS Content Path
#### Parameters
* `url: (string)` *(Optional)* CMS Page URL

   Use Full URL, Root-relative URL, or leave blank to use current URL
* `options: (object)` *(Optional)* Options
   ```less
   {
      // Whether to try URL variations (adding "/", "/<default_document>")
      strictUrlResolution: (bool), 

      // Starting Variation ID
      variation: (int)
   }
   ```
#### Returns
`(string)` CMS Content Path
#### Example
```js
var contentPath = cmsClient.resolve();
```

---

### render
`<jsHarmonyCmsClient>.render(url, options)`

Get CMS Content and Render
#### Parameters
* `url: (string)` *(Optional)* CMS Page URL

   Use Full URL, Root-relative URL, or leave blank to use current URL
* `options: (object)` *(Optional)* Options
   ```less
   {
      // Whether to execute HTTP requests synchronously (blocking)
      async: (bool),   

      // Function executed after page content is downloaded, before render
      onGetPageData: function(err){ /* return false to cancel page render */ }
   }
   ```
#### Returns
`Promise` 
#### Example
```js
cmsClient.render();
```

---

### route
`<jsHarmonyCmsClient>.route(url, options)`

Run client-side CMS router on the target URL
#### Parameters
* `url: (string)` *(Optional)* CMS Page URL

   Use Full URL, Root-relative URL, or leave blank to use current URL
* `options: (object)` *(Optional)* Options
   ```less
   {
      // Whether to execute HTTP requests synchronously (blocking)
      async: (bool),

      // Whether to force a redirect to the target URL if a matching route is not found
      redirectOnNotFound: (bool),

      // Whether to display a loading overlay while downloading / rendering content
      loadingOverlay: (bool)
   }
   ```
#### Returns
`Promise` 
#### Example
```js
cmsClient.route();
```


---

### getPageData
`<jsHarmonyCmsClient>.getPageData(url, options)`

Get CMS Page Data
#### Parameters
* `url: (string)` *(Optional)* CMS Page URL

   Use Full URL, Root-relative URL, or leave blank to use current URL
* `options: (object)` *(Optional)* Options
   ```less
   {
      // Whether to execute HTTP requests synchronously (blocking)
      async: (bool),

      // Starting Variation ID
      variation: (int)
   }
   ```
#### Returns
`Promise<Page>`
```less
Page {
  seo: {
      title: (string),   //Title for HEAD tag
      keywords: (string),
      metadesc: (string),
      canonical_url: (string)
  },
  css: (string),
  js: (string),
  header: (string),
  footer: (string),
  title: (string),      //Title for Page Body Content
  content: {
      <content_area_name>: <content> (string)
  },
  properties: {
      <property_name>: <property_value>
  },
  page_template_id: (string)
}
```
#### Example
```js
var page = await cmsClient.getPageData();
```

---

### getRedirectData
`<jsHarmonyCmsClient>.getRedirectData(options)`

Get CMS Redirect Data

Requires `config.redirect_listing_path` to be defined
#### Parameters
* `options: (object)` *(Optional)* Options
   ```less
   {
      // Whether to execute HTTP requests synchronously (blocking)
      async: (bool),
   }
   ```
#### Returns
`Promise<Array<Redirect>>`
```less
Redirect {
    http_code: (string) '301', '302', or 'PASSTHRU',
    url: (string) 'destination/url',
}
```
#### Example
```js
var cmsRedirects = await cmsClient.getRedirectData();
```

---

### renderPage
`<jsHarmonyCmsClient>.renderPage(page, options)`

Render CMS Page
#### Parameters
* `page: (Page)` CMS Page Data Object (from getPageData function)
* `options: (object)` *(Optional)* Options
   ```less
   {
      // Whether to route links in content areas using single-page JS
      bindLinks: (bool)
   }
   ```
#### Returns
`Promise`
#### Example
```js
cmsClient.renderPage(page);
```

---

### renderElement
`<jsHarmonyCmsClient>.renderElement(element, page, options)`

Renders CMS page data to the given element.
#### Parameters
* `element: (object)` Element To Update. Updates will be applied to all descendant nodes.
* `page: (Page)` CMS Page Data Object (from getPageData function)
* `options: (object)` *(Optional)* Options
   ```less
   {
      // Whether to route links in content areas using single-page JS
      bindLinks: (bool)
   }
   ```
#### Returns
`Promise`
#### Example
```js
cmsClient.renderElement(document.querySelector('#parentWrapper'), page);
```

---

### matchRedirect
`<jsHarmonyCmsClient>.matchRedirect(redirects, url)`

Check if URL matches redirects and return first match
#### Parameters
* `redirects: Array(object)` Array of CMS Redirects (from getRedirectData function)
* `url: (string)` Target URL to match against the CMS Redirects

   Use Full URL, Root-relative URL, or leave blank to use current URL
#### Returns
`(Redirect)` Redirect Data
```less
Redirect {
  http_code: '301', '302', or 'PASSTHRU',
  url: '<destination url>'
}
```
#### Example
```js
var redirect = cmsClient.matchRedirect(cmsRedirects);
if(redirect && ((redirect.http_code=='301') || (redirect.http_code=='302'))){
  window.location = redirect.url;
}
```

---

### bindLinks
`<jsHarmonyCmsClient>.bindLinks(obj)`

Bind links in container to the single-page CMS router
#### Parameters
* `obj: (DOM Node)` Container whose links will be bound to the CMS Router
#### Example
```js
cmsClient.bindLinks(document.body);
```

---
