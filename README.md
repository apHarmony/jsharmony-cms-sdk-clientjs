# jsharmony-cms-sdk-clientjs
jsHarmony CMS SDK for Client-side JS

## Installation

1. Download "jsHarmonyCmsClient.min.js" to your project

2. Add a "catchall" page to your web server.  For example, with Apache / htaccess:

   ```apacheconf
   RewriteRule ^(.*)$ default_page.html [L,QSA]
   ```

3. Add the jsHarmonyCmsClient.min.js script to your new page:

   ```html
   <script type="text/javascript" src="jsHarmonyCmsClient.min.js"></script>
   ```

3. Configure the Deployment Target in the jsHarmony CMS:

   a. In the jsHarmony CMS, open the "Sites" tab

   b. Click "Configure Site" on the target site

   c. Add a new Deployment Target

   d. Set the "URL Prefix" to the folder where the content will be published, for example "/content/"

   e. Set the "Override Page URL Prefix" to the root of the site, for example "/"

   
4. Copy the integration code from the jsHarmony CMS:

   a. In the jsHarmony CMS, open the "Sites" tab

   b. Click "Configure Site" on the target site

   c. Click "Edit" on the depoyment target

   d. Select the "Integration Code" tab

   e. Copy the Integration Code into your page, for example:

   ```html
   <script type="text/javascript">
   var cmsClient = new jsHarmonyCmsClient({"page_files_path":"/content/","access_keys":["xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"]});
   cmsClient.Router();
   </script>
   ```
   
5. Publish the content to the target folder, and test

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
* *Public Methods*
   * [Router](#router)
   * [Standalone](#standalone)
   * [isInEditor](#isineditor)
   * [resolve](#resolve)
   * [render](#render)
   * [route](#route)
   * [getPageData](#getpagedata)
   * [getRedirectData](#getredirectdata)
   * [renderPage](#renderpage)
   * [matchRedirect](#matchredirect)
   * [bindLinks](#bindlinks)

---

## Constructor

```js
new jsHarmonyCmsClient(config)
```

#### Arguments

- `config` (Object) :: Object with one or more of the configuration keys below:
```js
{
  access_keys: [],                //Array(string) CMS Editor Access Keys
  page_files_path: '/',           //(string) URL to page files
  redirect_listing_path: null,    //(string) URL to redirect listing JSON file
  default_document: 'index.html', //(string) Default Directory Document
  strict_url_resolution: false,   //(bool) Whether to try URL variations (add "/", "/<default_document>")
  cms_templates: ['*'],           //Array(string) List of Page Template Names supported by this instance, or use '*' for all
  bind_routing_events: true,      //(bool) Whether to auto-bind the routing events (link click, browser back / forward buttons) for single-page functionality
  footer_container: null,         //(string) CSS Selector - If set, use an element ID to insert page.footer content, instead of appending to the end of the page
}
```

#### Example
```js
var cmsClient = new jsHarmonyCmsClient({ access_keys: ['xxxxxxxxx'] });
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
`function(url, callback){ }`

Function executed when a matching route is not found for the URL
```js
cmsClient.onRouteNotFound = function(url, callback){ cmsClient.generate404(callback); };
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

### resolve
`<jsHarmonyCmsClient>.resolve(url, options)`

Converts URL to CMS Content Path
#### Parameters
* `url: (string)` *(Optional)* CMS Page URL

   Use Full URL, Root-relative URL, or leave blank to use current URL
* `options: (object)` *(Optional)* Options
   ```js
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
`<jsHarmonyCmsClient>.render(url, options, callback)`

Get CMS Content and Render
#### Parameters
* `url: (string)` *(Optional)* CMS Page URL

   Use Full URL, Root-relative URL, or leave blank to use current URL
* `options: (object)` *(Optional)* Options
   ```js
   {
      // Whether to execute HTTP requests synchronously (blocking)
      async: (bool),   

      // Function executed after page content is downloaded, before render
      onGetPageData: function(err){ /* return false to cancel page render */ }
   }
   ```
* `callback: function(err){ }` *(Optional)* Callback function executed on error or completion
#### Example
```js
cmsClient.render();
```

---

### route
`<jsHarmonyCmsClient>.route(url, options, callback)`

Run client-side CMS router on the target URL
#### Parameters
* `url: (string)` *(Optional)* CMS Page URL

   Use Full URL, Root-relative URL, or leave blank to use current URL
* `options: (object)` *(Optional)* Options
   ```js
   {
      // Whether to execute HTTP requests synchronously (blocking)
      async: (bool),

      // Whether to force a redirect to the target URL if a matching route is not found
      redirectOnNotFound: (bool),

      // Whether to display a loading overlay while downloading / rendering content
      loadingOverlay: (bool)
   }
   ```
* `callback: function(err){ }` *(Optional)* Callback function executed on error or completion
#### Example
```js
cmsClient.route();
```


---

### getPageData
`<jsHarmonyCmsClient>.getPageData(url, options, callback)`

Get CMS Page Data
#### Parameters
* `url: (string)` *(Optional)* CMS Page URL

   Use Full URL, Root-relative URL, or leave blank to use current URL
* `options: (object)` *(Optional)* Options
   ```js
   {
      // Whether to execute HTTP requests synchronously (blocking)
      async: (bool),

      // Starting Variation ID
      variation: (int)
   }
   ```
* `callback: function(err, rslt){ }` *(Optional)* Callback function executed on error or completion
#### Example
```js
var page = cmsClient.getPageData();
```

---

### getRedirectData
`<jsHarmonyCmsClient>.getRedirectData(options, callback)`

Get CMS Redirect Data

Requires `config.redirect_listing_path` to be defined
#### Parameters
* `options: (object)` *(Optional)* Options
   ```js
   {
      // Whether to execute HTTP requests synchronously (blocking)
      async: (bool),
   }
   ```
* `callback: function(err, rslt){ }` *(Optional)* Callback function executed on error or completion
#### Example
```js
var cmsRedirects = cmsClient.getRedirectData();
```

---

### renderPage
`<jsHarmonyCmsClient>.renderPage(page, options, callback)`

Render CMS Page
#### Parameters
* `page: (Page)` CMS Page Data Object (from getPageData function)
* `options: (object)` *(Optional)* Options
   ```js
   {
      // Whether to route links in content areas using single-page JS
      bindLinks: (bool)
   }
   ```
* `callback: function(){ }` *(Optional)* Callback function executed on completion
#### Example
```js
cmsClient.renderPage(page);
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
`(object)` Redirect Data
```js
{
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
