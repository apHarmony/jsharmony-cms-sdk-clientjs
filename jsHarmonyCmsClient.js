/*!
Copyright 2021 apHarmony

This file is part of jsHarmony.

jsHarmony is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

jsHarmony is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with this package.  If not, see <http://www.gnu.org/licenses/>.
*/
;(function(){

  var jsHarmonyCmsClient = (function(){
    require('./Promise.polyfill.js');
    function jsHarmonyCmsClient(config){
      var _this = this;
      var _GET = {};

      //==========
      //Parameters
      //==========
      config = extend({
        access_keys: [],                //Array(string) CMS Editor Access Keys (set to '*' to disable access key check)
        page_files_path: '/',           //(string) URL to page files
        redirect_listing_path: null,    //(string) URL to redirect listing JSON file
        default_document: 'index.html', //(string) Default Directory Document
        strict_url_resolution: false,   //(bool) Whether to try URL variations (add "/", "/<default_document>")
        cms_templates: ['*'],           //Array(string) List of Page Template Names supported by this instance, or use '*' for all
        bind_routing_events: true,      //(bool) Whether to auto-bind the routing events (link click, browser back / forward buttons) for single-page functionality
        footer_container: null,         //(string) CSS Selector - If set, use an element ID to insert page.footer content, instead of appending to the end of the page
        auto_init: true                 //(bool) Set false to prevent onInit() from being called in constructor. If false, the caller must call onInit() before using jsHarmonyCmsClient
      }, config);

      //=================
      //Public Properties
      //=================
      this.onError = function(err){ console.error(err.message); };  //function(err){ }
      this.onRouteNotFound = function(url){ _this.generate404(); }; //function(url){ }
      this.onPageRender = function(){} //function(page){ }
      this.onPageRendered = function(){} //function(page){ }
      this.onPageDestroy = function(){} //function(){ }
      this.onLinkClick = function(url, e){} //function(url,e){ /* return false to cancel click */ }
      this.onSaveState = function(url){ window.history.pushState({}, document.title, url); } //function(url){ }
      this.onRestoreState = function(url){ _this.route(url); } //function(url){ }
      this.onSetTitle = function(title){ /* return false to prevent document title from being set by client. */ }
      this.onSetMetaDescription = function(desc){/* return false to prevent <meta name="description"> from being set by client. */};
      this.onSetMetaKeywords = function(keywords){/* return false to prevent <meta name="keywords"> from being set by client. */};
      this.onSetCanonicalUrl = function(url){/* return false to prevent <link rel="canonical"> from being set by client. */};

      //=================
      //Private Properties
      //=================
      extend(this, config);

      this.liveRenderActive = false;
      this.liveRenderTriggers = [];
      this.cntInsertDivider = 0;
      this.isPopStateBound = false;
      this.initialRender = true;
      this.defaultContent = [];
      this.onProxyConfirmed = null;
      this.timers = {};

      this.isLoading = false;
      this.loadQueue = [];
      this.renderFunctions = {};

      //Constructor
      this.onInit = function(){
        if(!_this.isInEditor()) _this.appendRenderCss();
        if(_this.isInEditor()) _this.initEditor();
      }

      //================
      //Public Functions
      //================

      //Main Entry Point - Run CMS Router
      //Parameters:
      //  url: (string) CMS Page URL
      //         Use Full URL, Root-relative URL, or leave blank to use current URL
      this.Router = function(url){
        if(_this.isInEditor()) return;
        _this.route(url, { async: false, loadingOverlay: false });
      }

      //Main Entry Point - Load Standalone CMS Content
      //Parameters:
      //  url: (string) CMS Page URL
      //         Use Full URL, Root-relative URL, or leave blank to use current URL
      this.Standalone = function(url){
        if(_this.isInEditor()) return;
        _this.render(url, { async: false }, function(err){});
      }

      //Returns true if page is opened from CMS Editor
      this.isInEditor = function(){ return !!_GET.jshcms_token; }

      //Returns the template ID (if set) specified by the CMS Editor.
      this.getEditorTemplateId = function(){ return _GET.page_template_id || ''; }

      //Convert URL to CMS Content Path
      //Parameters:
      //  url: (string) CMS Page URL
      //         Use Full URL, Root-relative URL, or leave blank to use current URL
      //  options: (object) { strictUrlResolution: (bool), variation: (int) }
      this.resolve = function(url, options){
        options = _this.extend({
          strictUrlResolution: _this.strict_url_resolution,
          variation: 1,
        }, options);

        if(!url) url = window.location.href;
        //If URL is not absolute, add starting "/"
        if(url.indexOf('//')<0){
          if(url.indexOf('/') != 0){
            if(url.indexOf('\\')==0) url = url.substr(1);
            url = '/' + url;
          }
        }
        //Extract path
        var a = document.createElement('a');
        a.href = url;
        var urlpath = a.pathname;
        if(!urlpath || (urlpath[0] != '/')) urlpath = '/' + urlpath;
        //Add url prefix
        url = _this.joinPath(_this.page_files_path, urlpath);
        if(!options.strictUrlResolution){
          //Add trailing slash and "/index.html", if applicable
          if(url && ((url[url.length-1]=='/')||(url[url.length-1]=='\\'))){
            url = _this.joinPath(url, _this.default_document);
          }
          if(options.variation==1){ /* Do nothing */ }
          if(options.variation==2){
            var url_ext = _this.getExtension(url);
            var default_ext = _this.getExtension(_this.default_document);
            if(url_ext && default_ext && (url_ext == default_ext)) options.variation += 1;
            else {
              url = _this.joinPath(url, _this.default_document);
            }
          }
          if(options.variation>=3) throw new PageNotFoundError(urlpath);
        }
        else if(options.variation>=2) throw new PageNotFoundError(urlpath);
        return url;
      }

      //Get CMS Page Data
      //Parameters:
      //  url: (string) CMS Page URL
      //         Use Full URL, Root-relative URL, or leave blank to use current URL
      //  options: (object) { async: (bool), variation: (int) }
      //  callback: function(err, rslt){}
      //Returns: Promise<Page>
      this.getPageData = function(orig_url, options, callback){
        return new Promise(function(resolve, reject){
          if(!callback) callback = function(err, page){
            if(err){ _this.onError(err); return reject(err); }
            return resolve(page);
          };
          else resolve();
          options = _this.extend({
            async: true,
            variation: 1,
          }, options);
          var url = orig_url;
          try{
            url = _this.resolve(url, options);
          }
          catch(ex){
            return callback(ex);
          }
          _this.getJSON(url, { async: options.async }, function(err, rslt){
            if(err && err.message && (err.message.indexOf('Error 404:')==0)){
              options.variation++;
              return _this.getPageData(orig_url, options, callback);
            }
            return callback(err, rslt);
          });
        });
      }

      //Get CMS Redirect Data
      //Parameters:
      //  options: (object) { async: (bool) }
      //  callback: function(err, rslt){}
      //Returns: Promise<Array<Redirect>>
      this.getRedirectData = function(options, callback){
        return new Promise(function(resolve, reject){
          if(!callback) callback = function(err, redirects){
            if(err){ _this.onError(err); return reject(err); }
            return resolve(redirects);
          };
          else resolve();
          options = _this.extend({
            async: true,
          }, options);
          var redirect_listing_path = _this.redirect_listing_path;
          if(!redirect_listing_path) return callback();
          if((redirect_listing_path[0]!='/') && (redirect_listing_path[0]!='\\')){
            redirect_listing_path = _this.joinPath(_this.page_files_path, redirect_listing_path);
          }
          _this.getJSON(redirect_listing_path, { async: options.async }, function(err, rslt){
            if(err) return callback(err);
            return callback(null, rslt);
          });
        });
      }

      //Get CMS Content and Render
      //Parameters:
      //  url: (string) CMS Page URL
      //         Use Full URL, Root-relative URL, or leave blank to use current URL
      //  options: (object) { async: (bool), onGetPageData: function(err){ /* return false to cancel page render */ } }
      //  callback: function(err){}
      //Returns: Promise
      this.render = function(url, options, callback){
        return new Promise(function(resolve, reject){
          if(!callback) callback = function(err){
            if(err){ _this.onError(err); return reject(err); }
            return resolve();
          };
          else resolve();
          options = _this.extend({
            async: true,
            onGetPageData: null,
          }, options);
          _this.getPageData(url, { async: options.async }, function(err, page){
            if(options.onGetPageData){ if(options.onGetPageData(err, page)===false) return; }
            if(err){
              if(err.name == 'PageNotFoundError') return callback(err);
              return callback(new Error('Error loading content: '+err.message));
            }
            _this.renderPage(page, {}, callback);
          });
        });
      }

      //Render CMS Page Data To Element
      //Parameters:
      //  element: (object) Parent Element To Update
      //  page: (object) CMS Page Data
      //  options: (object) { bindLinks: (bool) Route links in content areas using single-page JS }
      //  callback: function(){}
      //Returns: Promise
      this.renderElement = function(element, page, options, callback){
        return new Promise(function(resolve){
          if(!callback) callback = function(){
            return resolve();
          };
          else resolve();

          if(!element) return callback();

          options = _this.extend({
            bindLinks: _this.bind_routing_events,
          }, options);
          page = page || {};
          page.content = page.content || {};
          _this.liveRender(
            function(){ return element.querySelectorAll('[cms-content-editor],[cms-component-content]'); },
            function(obj){ _this.renderComponentsAndContent(page, obj, options); },
            undefined,
            function(){
              _this.liveRender(
                function(){ return element.querySelectorAll('[cms-template]'); },
                function(obj){ _this.applyCmsTemplateLogic(page, obj); },
                undefined,
                function(){
                  _this.liveRender(
                    function(){ return element.querySelectorAll('[cms-onrender]'); },
                    function(obj){ _this.evalCmsOnRender(page, obj)},
                    undefined,
                    function(){ if(callback) callback(); }
                  );
                }
              );
            });
        });
      }

      //Render CMS Page
      //Parameters:
      //  page: (object) CMS Page Data
      //  options: (object) { bindLinks: (bool) Route links in content areas using single-page JS }
      //  callback: function(){}
      //Returns: Promise
      this.renderPage = function(page, options, callback){
        return new Promise(function(resolve, reject){
          if(!callback) callback = function(){
            return resolve();
          };
          else resolve();
          options = _this.extend({
            bindLinks: _this.bind_routing_events,
          }, options);
          page = page || {};
          page.content = page.content || {};
          page.properties = page.properties || {};
          page.seo = page.seo || {};
          _this.onPageRender(page);
          _this.liveRender(
            function(){ if(document && document.head) return [document.head]; return []; },
            function(obj){
              if(!_this.initialRender) _this.destroyPage();
              if((page.header||'').trim()) _this.appendHtml(document.head, page.header, 'header');
              if((page.css||'').trim()) _this.appendCss('jshcms_page_render_styles', page.css);
              if(page.seo){
                _this.appendTag(document.head, 'script', { id: 'jshcms-insert-divider-seo-start' });
                if(page.seo.metadesc && (!_this.onSetMetaDescription || _this.onSetMetaDescription(page.seo.metadesc) !== false)){
                  _this.appendTag(document.head, 'meta', { name: 'description', content: page.seo.metadesc });
                }
                if(page.seo.keywords && (!_this.onSetMetaKeywords || _this.onSetMetaKeywords(page.seo.keywords) !== false)){
                  _this.appendTag(document.head, 'meta', { name: 'keywords', content: page.seo.keywords });
                }
                if(page.seo.canonical_url && (!_this.onSetCanonicalUrl || _this.onSetCanonicalUrl(page.seo.canonical_url)) !== false){
                  _this.appendTag(document.head, 'link', { rel: 'canonical', href: page.seo.canonical_url });
                }
                _this.appendTag(document.head, 'script', { id: 'jshcms-insert-divider-seo-end' });
              }
              var newTitle = ((page.seo && page.seo.title ? page.seo.title : page.title) || '').toString();
              if(newTitle.trim()) {
                if (!_this.onSetTitle || _this.onSetTitle(newTitle) !== false) document.title = newTitle;
              }
            },
            { addClass: false }
          );
          _this.liveRender('[cms-content-editor],[cms-component-content]', function(obj){
            _this.renderComponentsAndContent(page, obj, options);
          });
          _this.liveRender('[cms-title]', function(obj){
            var defaultContent = _this.getDefaultContent(obj);
            if(typeof defaultContent == 'undefined') _this.setDefaultContent(obj, obj.innerHTML);
            if(page.title){
              obj.innerHTML = '';
              obj.textContent = (page.title||'').toString();
            }
            else if(typeof defaultContent != 'undefined') obj.innerHTML = defaultContent;
          });
          _this.liveRender('[cms-template]', function(obj){
            _this.applyCmsTemplateLogic(page, obj);
          });
          _this.liveRender('[cms-onrender]', function(obj){
            _this.evalCmsOnRender(page, obj);
          });
          if((page.js||'').trim()) _this.evalWindow(page.js);
          _this.liveRender('', function(){}, {}, function(){
            //On Complete
            if((page.footer||'').trim()){
              var footerContainer = document.body;
              if(_this.footer_container){
                footerContainer = document.querySelectorAll(_this.footer_container);
                if(footerContainer && footerContainer.length) footerContainer = footerContainer[0];
                else footerContainer = null;
              }
              _this.appendHtml(footerContainer, page.footer, 'footer');
            }
            setTimeout(function(){
              _this.onPageRendered(page);
              _this.initialRender = false;
              if(callback) callback();
            }, 0);
          });
        });
      }

      //Run client-side CMS router
      //Parameters:
      //  url: (string) CMS Page URL
      //         Use Full URL, Root-relative URL, or leave blank to use current URL
      //  options: (object) { async: (bool), redirectOnNotFound: (bool), loadingOverlay: (bool) }
      //  callback: function(err){}
      //Returns: Promise
      this.route = function(url, options, callback){
        if(_this.isInEditor()) return;
        return new Promise(function(resolve, reject){
          if(!callback) callback = function(err){
            if(err){ _this.onError(err); return reject(err); }
            return resolve();
          };
          else resolve();
          if(url) url = url.toString();
          var sameUrl = (!url || (url == window.location.href));
          options = _this.extend({
            async: true,
            redirectOnNotFound: !sameUrl,
            loadingOverlay: true,
          }, options);
          var loadObj = {};
          _this.removeElement('jsHarmonyCMSClientProxy');
          if(options.loadingOverlay) _this.startLoading(loadObj, { fadeIn: options.async });
          var stopLoading = function(){ if(options.loadingOverlay) _this.stopLoading(loadObj); };

          if(_this.bind_routing_events) _this.bindPopState();
          _this.getRedirectData({ async: options.async }, function(err, redirects){
            if(err){ stopLoading(); return callback(new Error('Error loading redirects: '+err.message)); }
            var redirect = _this.matchRedirect(redirects, url);
            if(redirect){
              var http_code = (redirect.http_code||'').toString();
              if(http_code=='301'){ stopLoading(); _this.route(redirect.url, { async: options.async, loadingOverlay: options.loadingOverlay }, callback); return; }
              else if(http_code=='302'){ stopLoading(); _this.route(redirect.url, { async: options.async, loadingOverlay: options.loadingOverlay }, callback); return; }
              else if(http_code=='PASSTHRU'){
                _this.execIf(window.parent && (window.parent != window.self),
                  function(next){
                    window.parent.postMessage('jshcms_isInProxy', '*');
                    var proxyTimeout = setTimeout(function(){
                      _this.onProxyConfirmed = null;
                      next();
                    },500);
                    _this.onProxyConfirmed = function(){
                      window.clearTimeout(proxyTimeout);
                      if(!sameUrl) window.location = redirect.url;
                    };
                  },
                  function(){
                    stopLoading();
                    //Full screen iframe
                    _this.liveRender(
                      function(){ if(document && document.body) return [document.body]; return []; },
                      function(obj){
                        _this.appendIframe(document.body, 'jsHarmonyCMSClientProxy', redirect.url);
                        if(_this.bind_routing_events && !sameUrl) _this.pushUrlState(url);
                      },
                      { addClass: false }
                    );
                  }
                );
                return;
              }
              else{ stopLoading(); return callback(new Error('Invalid redirect HTTP code: '+http_code)); }
            }
            else {
              _this.render(url,
                {
                  async: options.async,
                  onGetPageData: function(err, page){
                    if(err){
                      if(err.name == 'InvalidJsonError'){
                        window.location = err.originalUrl;
                        return false;
                      }
                      return;
                    }
                    if(page && page.page_template_id && !sameUrl){
                      if((page.page_template_id=='<Standalone>') || (!_this.contains(_this.cms_templates, '*') && !_this.contains(_this.cms_templates, page.page_template_id))){
                        window.location = url;
                        return false;
                      }
                    }
                  }
                },
                function(err){
                  //Change URL
                  function onComplete(err){ stopLoading(); return callback(err); }
                  if(err){
                    if(err.name == 'PageNotFoundError'){
                      if(options.redirectOnNotFound){ window.location = url; return; }
                      //Generate 404
                      if(_this.bind_routing_events && !sameUrl) _this.pushUrlState(url);
                      return _this.onRouteNotFound(url, onComplete);
                    }
                  }
                  if(_this.bind_routing_events && !sameUrl) _this.pushUrlState(url);
                  return onComplete(err);
                }
              );
            }
          });
        });
      }

      //Check if URL matches redirects and return first match
      //Parameters:
      //  redirects: Array(object) Array of CMS Redirects
      //  url: (string) Target URL
      //         Use Full URL, Root-relative URL, or leave blank to use current URL
      //Returns:
      //{
      //  http_code: '301', '302', or 'PASSTHRU',
      //  url: 'destination/url',
      //}
      this.matchRedirect = function(redirects, url){
        if(!url) url = window.location.href;
        //If URL is not absolute, add starting "/"
        if(url.indexOf('//')<0){
          if(url.indexOf('/') != 0){
            if(url.indexOf('\\')==0) url = url.substr(1);
            url = '/' + url;
          }
        }
        //Extract path
        var a = document.createElement('a');
        a.href = url;
        var urlpath = a.pathname;
        if(!urlpath || (urlpath[0] != '/')) urlpath = '/' + urlpath;

        if(redirects && redirects.length){
          for(var i=0;i<redirects.length;i++){
            var redirect = redirects[i];
            if(!redirect) continue;
            var cmpurlpath = (redirect.redirect_url||'').toString();
            var desturl = (redirect.redirect_dest||'').toString();
            if(redirect.redirect_url_type=='EXACT'){
              if(urlpath != cmpurlpath) continue;
            }
            else if(redirect.redirect_url_type=='EXACTICASE'){
              if(urlpath.toLowerCase() != cmpurlpath.toLowerCase()) continue;
            }
            else if((redirect.redirect_url_type=='BEGINS')||(redirect.redirect_url_type=='BEGINSICASE')){
              if(!_this.beginsWith(urlpath, cmpurlpath, (redirect.redirect_url_type=='BEGINSICASE'))) continue;
            }
            else if((redirect.redirect_url_type=='REGEX')||(redirect.redirect_url_type=='REGEXICASE')){
              var rxMatch = urlpath.match(new RegExp(cmpurlpath,((redirect.redirect_url_type=='REGEXICASE')?'i':'')));
              if(!rxMatch) continue;
              for(var j=rxMatch.length;j>=1;j--){
                desturl = _this.replaceAll(desturl, '$'+j.toString(), rxMatch[j]);
              }
            }
            return {
              http_code: redirect.redirect_http_code,
              url: desturl,
            };
          }
        }
        return undefined;
      }

      //Bind links in container to use single-page router on click
      //Parameters:
      //  obj: (DOM Object) Container whose links will be bound to router
      this.bindLinks = function(obj){
        try{
          obj.removeEventListener('click', linkClickHandler);
        }
        catch(ex){
        }
        obj.addEventListener('click', linkClickHandler);
      }


      //==================
      //Internal Functions
      //==================

      //CMS Render Functions
      //--------------------

      //showIf, toggle
      this.renderFunctions.showIf = function(show){
        var obj = this;
        if(!show) obj.classList.add('jshcms_onrender_hide');
        else obj.classList.remove('jshcms_onrender_hide');
      };
      this.renderFunctions.toggle = this.renderFunctions.showIf;

      //addClass, setClass
      this.renderFunctions.addClass = function(strClasses){
        var obj = this;

        var prevClasses = [];
        for(var i=0;i<obj.classList.length;i++){
          var className = obj.classList[i];
          if(!className || _this.beginsWith(className, 'jshcms_rendered_')) continue;
          prevClasses.push(className);
        }

        if(!obj.hasAttribute('jshcms_properties_initClass')) obj.setAttribute('jshcms_properties_initClass', prevClasses.join(' '));
        var initClasses = (obj.getAttribute('jshcms_properties_initClass')||'').toString().trim().split(' ');

        strClasses = (strClasses||'').toString().trim().split(' ');
        for(var i=0;i<strClasses.length;i++){
          strClasses[i] = strClasses[i].trim();
          if(strClasses[i]) obj.classList.add(strClasses[i]);
        }
        for(var i=0;i<prevClasses.length;i++){
          if(_this.contains(strClasses, prevClasses[i])) continue;
          if(_this.contains(initClasses, prevClasses[i])) continue;
          if(prevClasses[i]) obj.classList.remove(prevClasses[i]);
        }
      };
      this.renderFunctions.setClass = this.renderFunctions.addClass;

      //addStyle, setStyle
      this.renderFunctions.addStyle = function(strStyle){
        var obj = this;
        if(!obj.hasAttribute('jshcms_properties_initStyle')) obj.setAttribute('jshcms_properties_initStyle', obj.style.cssText);
        var initStyle = (obj.getAttribute('jshcms_properties_initStyle')||'').toString();

        strStyle = (strStyle||'').toString().trim();
        var newStyle = initStyle + ((initStyle && !_this.endsWith(initStyle,';')) ? ';' : '') + strStyle;
        obj.setAttribute('style', newStyle);
      };
      this.renderFunctions.setStyle = this.renderFunctions.addStyle;

      //CMS Frontend Helper Functions
      //-----------------------------

      this.destroyPage = function(){
        _this.onPageDestroy();
        _this.removeHtml('header');
        _this.removeHtml('seo');
        _this.removeHtml('footer');
        _this.removeElement('jshcms_page_render_styles');
      }

      this.getDefaultContent = function(obj){
        for(var i=0;i<_this.defaultContent.length;i++){
          if(_this.defaultContent[i].node == obj) return _this.defaultContent[i].content;
        }
      }

      this.setDefaultContent = function(obj, val){
        for(var i=0;i<_this.defaultContent.length;i++){
          if(_this.defaultContent[i].node == obj){ _this.defaultContent[i].content = val; return }
        }
        _this.defaultContent.push({ node: obj, content: val });
      }

      this.generate404 = function(){
        return _this.renderPage({
          title: 'Not Found',
          content: { body: 'The requested page was not found on this server.' }
        }, {}, function(){});
      }

      this.evalBoolAttr = function(expr, f){
        expr = _this.map(expr.split('||'), function(val){ return val.split('&&'); });
        var rsltOr = false;
        for(var i=0;i<expr.length;i++){
          var exprOr = expr[i];
          var rsltAnd = true;
          for(var j=0;j<exprOr.length;j++){
            var exprAnd=exprOr[j].trim();
            rsltAnd = rsltAnd && (exprAnd && (exprAnd[0]=='!')) ? !f(exprAnd.substr(1)) : !!f(exprAnd);
          }
          rsltOr = rsltOr || rsltAnd;
        }
        return rsltOr;
      }

      this.renderComponentsAndContent = function(page, obj, options){
        var contentArea = (obj.getAttribute('cms-component-content')||'').toString() || (obj.getAttribute('cms-content-editor')||'').toString();
        if(contentArea.indexOf('page.content.')==0) contentArea = contentArea.substr(('page.content.').length);
        if(contentArea){
          var defaultContent = _this.getDefaultContent(obj);
          if(typeof defaultContent == 'undefined') _this.setDefaultContent(obj, obj.innerHTML);
          if(contentArea in page.content) obj.innerHTML = (page.content[contentArea]||'').toString();
          else if(typeof defaultContent != 'undefined') obj.innerHTML = defaultContent;
          if(options.bindLinks) _this.bindLinks(obj);
        }
      }

      this.applyCmsTemplateLogic = function(page, obj){
        var templateCond = obj.getAttribute('cms-template');
        _this.renderFunctions.showIf.call(obj, _this.evalBoolAttr(templateCond, function(val){ return val == page.page_template_id; }));
      }

      this.evalCmsOnRender = function(page, obj){
        var renderScript = (obj.getAttribute('cms-onrender')||'').toString().trim();
        var renderParams = { page: page };
        for(var key in _this.renderFunctions) renderParams[key] = _this.renderFunctions[key].bind(obj);
        _this.evalJS(renderScript, obj, renderParams);
      }

      function PageNotFoundError(url){
        var instance = new Error('Page not found: '+url);
        instance.name='PageNotFoundError';
        return instance;
      }
      PageNotFoundError.prototype = Object.create(Error.prototype, { constructor: { value: Error, enumerable: false, writable: true, configurable: true } });

      function InvalidJsonError(url, content){
        var instance = new Error('Invalid JSON response: '+content);
        instance.name='InvalidJsonError';
        instance.originalUrl = url;
        return instance;
      }
      InvalidJsonError.prototype = Object.create(Error.prototype, { constructor: { value: Error, enumerable: false, writable: true, configurable: true } });

      //Single-Page
      //-----------

      function linkClickHandler(e){
        if(e.target && e.target.href){
          var targetUrl = e.target.href;
          e.preventDefault();
          if(_this.onLinkClick(targetUrl, e)===false) return;
          _this.route(targetUrl);
        }
      }

      this.pushUrlState = function(url){
        if(_this.bind_routing_events) _this.bindPopState();
        _this.onSaveState(url);
      }

      this.bindPopState = function(){
        if(!_this.isPopStateBound){
          window.addEventListener('popstate', function(event){
            _this.onRestoreState(window.location.href);
          });
          _this.isPopStateBound = true;
        }
      }

      //CMS Editor
      //----------

      this.initEditor = function(){
        if(!_GET.jshcms_token) return;
        if(!_GET.jshcms_access_key) return alert('Missing CMS Access Key querystring parameter');
        if(!_GET.jshcms_url) return alert('Missing CMS URL querystring parameter');
        if(!document || (document.compatMode !== 'CSS1Compat')) return alert('CMS Editor requires Standards Document mode.  Please add "<!DOCTYPE html>" to the top of the HTML');
        _this.startLoading(_this);
        _this.validateAccessKey(_GET.jshcms_access_key, _GET.jshcms_url, _GET._, function(err, valid){
          if(!valid) return alert('Invalid CMS Access Key');
          //Load CMS JS
          var entry_url = _GET.jshcms_url+'js/jsHarmonyCMS.js';
          _this.loadScript(entry_url, function(){
            _this.stopLoading(_this);
          });
        });
      }

      this.validateAccessKey = function(access_key, server_url, timestamp, callback){
        access_key = access_key.toString();
        server_url = server_url.toLowerCase();
        timestamp = parseInt(timestamp||'');
        if(!timestamp || (timestamp < (new Date().getTime() - 7 * 24 * 60 * 60 * 1000)) || (timestamp > (new Date().getTime() + 24 * 60 * 60 * 1000))) return callback(null, false);
        if(access_key.length < 64) return;
        var access_hash = access_key.substr(32);
        var access_salt = '';
        for(var i=0;i<8;i++){
          var salt_part = parseInt(access_key.substr(i*4,4), 16);
          var domain_part = parseInt(access_hash.substr(i*4,4), 16);
          access_salt += _this.pad((salt_part ^ domain_part).toString(16).toLowerCase(), '0', 4);
        }
        if(!Array.isArray(_this.access_keys)) _this.access_keys = [_this.access_keys];
        var foundMatch = false;
        _this.eachParallel(_this.access_keys, function(test_key, idx, validate_cb){
          var test_key = (test_key||'').toString();
          if(test_key == '*'){ foundMatch = true; return validate_cb(); }
          if(!test_key || (test_key.length < 64)) return validate_cb();
          var test_domain_hash = test_key.substr(32);
          var test_salt = '';
          for(var i=0;i<8;i++){
            var test_salt_part = parseInt(test_key.substr(i*4,4), 16);
            var test_domain_part = parseInt(test_domain_hash.substr(i*4,4), 16);
            test_salt += _this.pad((test_salt_part ^ test_domain_part).toString(16).toLowerCase(), '0', 4);
          }
          if(access_salt!==test_salt) return validate_cb();
          window.crypto.subtle.digest('SHA-256', Uint8Array.from((test_salt+'-'+server_url).split('').map(function(chr){ return chr.charCodeAt(0); }))).then(function(rslt){
            var domain_hash = Array.prototype.slice.call(new Uint8Array(rslt)).map(function(b){ return ('00' + b.toString(16)).slice(-2); }).join('');
            if(domain_hash!==test_domain_hash) return validate_cb();
            window.crypto.subtle.digest('SHA-256', Uint8Array.from((test_salt+'-'+server_url+'-'+(timestamp||'').toString()).split('').map(function(chr){ return chr.charCodeAt(0); }))).then(function(rslt){
              var test_access_hash = Array.prototype.slice.call(new Uint8Array(rslt)).map(function(b){ return ('00' + b.toString(16)).slice(-2); }).join('');
              if(access_hash!==test_access_hash) return validate_cb();
              foundMatch = true;
              return validate_cb();
            }, function(err){ return validate_cb(err); });
          }, function(err){ return validate_cb(err); });
        }, function(err){
          if(err) return callback(err);
          return callback(null, foundMatch);
        });
      }

      //Live Render
      //-----------

      this.liveRenderRefreshAll = function(){
        if(!_this.liveRenderActive) return;
        var allTriggers = this.liveRenderTriggers.slice(0);
        for(var i=0;i<allTriggers.length;i++){
          _this.liveRenderRefresh(allTriggers[i]);
        }
      }

      this.liveRenderRefresh = function(trigger){
        if(!trigger.selector) return;

        var isSelectorFunc = (typeof(trigger.selector) === 'function');
        var nodes = (isSelectorFunc ? trigger.selector() : document.querySelectorAll(trigger.selector)) || [];
        var newNodes = [];
        for(var i=0;i<nodes.length;i++){
          var foundNode = false;
          for(var j=0;j<trigger.lastNodes.length;j++){
            if(nodes[i]==trigger.lastNodes[j]){ foundNode = true; break; }
          }
          if(!foundNode) newNodes.push(nodes[i]);
        }
        trigger.lastNodes = nodes;
        for(var i=0;i<newNodes.length;i++){
          var obj = newNodes[i];
          if(trigger.options.addClass){
            if(obj.classList.contains('jshcms_rendered_'+trigger.id)) continue;
            obj.classList.add('jshcms_rendered_'+trigger.id);
          }
          trigger.action(obj);
        }
      }

      this.liveRender = function(sel, action, options, onComplete){
        action = action || function(){};
        onComplete = onComplete || function(){};
        options = options || {};
        if(!('addClass' in options)) options.addClass = true;
        var newTrigger = { selector: sel, action: action, lastNodes: [], onComplete: onComplete, options: options, id: _this.liveRenderTriggers.length+1 };
        _this.liveRenderTriggers.push(newTrigger);
        _this.liveRenderRefresh(newTrigger);
        if(_this.liveRenderActive) return;
        _this.liveRenderActive = true;

        document.addEventListener('readystatechange', function(){
          _this.liveRenderRefreshAll();
        });
        var observer = null;
        if(document){
          observer = new MutationObserver(function(mutationsList, observer){ _this.liveRenderRefreshAll(); });
          observer.observe(document, { childList: true, subtree: true });
        }
        setTimeout(function(){
          if(observer) observer.disconnect();
          _this.liveRenderRefreshAll();
          for(var i=0;i<_this.liveRenderTriggers.length;i++) _this.liveRenderTriggers[i].onComplete();
          for(var i=0;i<_this.liveRenderTriggers.length;i++){
            var triggerClass = 'jshcms_rendered_'+_this.liveRenderTriggers[i].id;
            var triggerObjects = document.querySelectorAll('.'+triggerClass);
            for(var j=0;j<triggerObjects.length;j++) triggerObjects[j].classList.remove(triggerClass);
          }
          _this.liveRenderTriggers = [];
          _this.liveRenderActive = false;
        }, 0);
      }

      //Utility - Path
      //--------------

      this.joinPath = function(a,b){
        if(!a) return b||'';
        if(!b) return a||'';
        var aEnd = a[a.length-1];
        var bStart = b[0];
        while(a.length && ((aEnd=='/')||(aEnd=='\\'))){ a = a.substr(0,a.length-1); if(a.length) aEnd=a[a.length-1]; }
        while(b.length && ((bStart=='/')||(bStart=='\\'))){ b = b.substr(1); if(b.length) bStart=b[0]; }
        return a + '/' + b;
      }

      this.getExtension = function(path){
        if(!path) return '';
        var lastSlash = 0;
        for(var i=path.length-1;i>=0;i--){
          if((path[i]=='/')||(path[i]=='\\')){ lastSlash = i+1; break; }
        }
        path = path.substr(lastSlash);
        if(!path) return '';
        var lastDot = path.lastIndexOf('.');
        if(lastDot >= 0) path = path.substr(lastDot);
        return path;
      }

      //Utility - JS Extensions
      //-----------------------

      function extend(dst, src){
        if(src){
          for(var key in src) dst[key] = src[key];
        }
        return dst;
      }
      this.extend = extend;

      this.contains = function(arr, val){
        if(!arr) return false;
        for(var i=0;i<arr.length;i++){
          if(arr[i]==val) return true;
        }
        return false;
      }

      this.map = function(arr, f){
        var rslt = [];
        for(var i=0;i<arr.length;i++){
          rslt.push(f(arr[i]));
        }
        return rslt;
      }

      this.endsWith = function (str, suffix, caseInsensitive) { if(caseInsensitive){ str = (str||'').toLowerCase(); suffix = (suffix||'').toLowerCase(); } return (str||'').toString().match(suffix + "$") == suffix; }

      this.beginsWith = function (str, prefix, caseInsensitive) { if(caseInsensitive){ str = (str||'').toLowerCase(); prefix = (prefix||'').toLowerCase(); } return (str||'').toString().indexOf(prefix) === 0; }

      this.trimToken = function (str, token, dir, cnt, caseInsensitive) {
        if(dir=='start') dir = 1;
        if(dir=='end') dir = -1;
        if(typeof cnt == 'undefined') cnt = cnt || -1;
        while(cnt != 0){
          str = str.trim();
          if(!(dir >= 0 ? _this.beginsWith(str, token, caseInsensitive) : _this.endsWith(str, token, caseInsensitive))) break;
          str = (dir >= 0 ? str.substr(token.length) : str.substr(0, str.length - token.length));
          if(cnt > 0) cnt--;
        }
        return str;
      }

      this.replaceAll = function (val, find, replace) { return val.split(find).join(replace); }

      this.evalWindow = function(code){
        if (window.execScript) return window.execScript(code);
        (function() { window.eval.call(window, code); })();
      }

      this.evalJS = function(str, _thisobj, params){
        if(!_thisobj) _thisobj = window;
        if(!params) params = {};
        var paramstr = '';
        if(params){
          for(var param in params){
            paramstr += 'var '+param+'=params.'+param+';';
          }
        }
        var jscmd = '(function(){'+paramstr+'return (function(){'+str+'})();}).call(_thisobj)';
        return eval(jscmd);
      }

      this.eachParallel = function(arr, f, callback){
        var f_complete = [];
        var err_returned = false;
        for(var i=0;i<arr.length;i++) f_complete.push(false);
        for(var i=0;i<arr.length;i++){
          (function(){
            var idx = i;
            f(arr[idx], idx, function(err){
              if(err_returned) return;
              if(err){
                err_returned = true;
                return callback(err);
              }
              else{
                f_complete[idx] = true;
                var allComplete = true;
                for(var j=0;j<f_complete.length;j++){ if(!f_complete[j]) allComplete = false; }
                if(allComplete) return callback();
              }
            });
          })();
        }
      }

      this.pad = function(val, padding, length) {
        var rslt = val.toString();
        while (rslt.length < length) rslt = padding + rslt;
        return rslt;
      }

      this.chain = function (orig_f, f) {
        if (!orig_f) return f;
        return function () {
          var rslt = f.apply(this, arguments);
          if(typeof rslt != 'undefined') return rslt;
          return orig_f.apply(this, arguments);
        };
      }

      this.execIf = function (cond, apply, f) {
        if (cond) apply(f);
        else f();
      }

      //Utility - Network
      //-----------------

      this.getJSON = function(url, options, callback){
        options = _this.extend({
          async: true,
        }, options);
        var req = new XMLHttpRequest();
        req.open('GET', url, options.async);
        req.onload = function() {
          var httpStatus = this.status;
          if (httpStatus >= 200 && httpStatus < 400){
            var rslt = {};
            try {
              rslt = JSON.parse(this.response);
            }
            catch(ex){
              return callback(new InvalidJsonError(url, this.response));
            }
            return callback(null, rslt);
          }
          else {
            return callback(new Error('Error '+httpStatus+': '+(this.response||'')));
          }
        };
        req.onerror = function() {
          return callback(new Error('Connection Error'));
        };
        req.send();
      }

      this.loadScript = function(url, cb){
        var script = document.createElement('script');
        if(cb) script.onload = cb;
        script.src = url;
        if(script.classList) script.classList.add('removeOnPublish');
        document.head.appendChild(script);
      }

      this.loadScriptSync = function(url){
        var req = new XMLHttpRequest();
        req.open('GET', url, false);
        req.onload = function() {
          var httpStatus = this.status;
          if (httpStatus >= 200 && httpStatus < 400){
            _this.evalWindow(this.response);
          }
          else {
            throw new Error('Error '+httpStatus+' loading script "'+url+'": '+(this.response||''));
          }
        };
        req.onerror = function() {
          throw new Error('Connection Error loading script "'+url+'"');
        };
        req.send();
      }

      this.parseGET = function (qs) {
        if (typeof qs == 'undefined') qs = window.location.search;
        if (qs == "" || qs.length == 1) return {};
        if (qs[0] == '?' || qs[0] == '#') qs = qs.substr(1);
        var qsa = qs.split('&');
        var b = {};
        for (var i = 0; i < qsa.length; i++) {
          var p = qsa[i].split('=', 2);
          if (p.length == 1)
            b[p[0]] = "";
          else
            b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
        }
        return b;
      };

      //Utility - DOM
      //-------------

      this.removeHtml = function(dividerId){
        var dividerStartNode = document.getElementById('jshcms-insert-divider-'+dividerId+'-start');
        if(dividerStartNode){
          var container = dividerStartNode.parentNode;
          var foundStart = false;
          if(container) for(var i=0;i<container.childNodes.length;i++){
            var node = container.childNodes[i];
            if(!node) continue;
            var nodeId = node.id;
            if(!foundStart){
              if(nodeId == ('jshcms-insert-divider-'+dividerId+'-start')) foundStart = true;
            }
            if(foundStart){
              container.removeChild(node);
              i--;
              if(nodeId == ('jshcms-insert-divider-'+dividerId+'-end')) break;
            }
          }
        }
      }

      this.appendHtml = function(container, html, dividerId){
        if(!container) return;
        //Insert script as a boundary
        var saveDivider = !!dividerId;
        if(!dividerId) dividerId = ++_this.cntInsertDivider;
        container.insertAdjacentHTML('beforeend', '<script id="jshcms-insert-divider-'+dividerId+'-start"></script>');
        container.insertAdjacentHTML('beforeend', html);
        container.insertAdjacentHTML('beforeend', '<script id="jshcms-insert-divider-'+dividerId+'-end"></script>');

        //Find the script, put all new nodes into an array, and remove the script
        var newNodes = [];
        var dividerStartNode = null;
        var dividerEndNode = null;
        for(var i=0;i<container.childNodes.length;i++){
          var node = container.childNodes[i];
          if(!node) continue;
          if(!dividerStartNode){
            if(node.id == ('jshcms-insert-divider-'+dividerId+'-start')){
              dividerStartNode = node;
            }
          }
          else{
            if(node.id == ('jshcms-insert-divider-'+dividerId+'-end')){
              dividerEndNode = node;
              break;
            }
            newNodes.push(node);
          }
        }
        if(!saveDivider){
          if(dividerStartNode) container.removeChild(dividerStartNode);
          if(dividerEndNode) container.removeChild(dividerEndNode);
        }

        //Recursively check nodes for "script" tag
        function forNodes(nodes, cond, action){
          for(var i=0;i<nodes.length;i++){
            var childNode = nodes[i];
            if(!childNode) continue;
            if(cond(childNode)) action(childNode);
            if(childNode.childNodes) forNodes(childNode.childNodes, cond, action);
          }
        }

        var scriptNodes = [];
        forNodes(newNodes,
          function(obj){ return (obj && (obj.nodeName||'').toString().toUpperCase()=='SCRIPT'); },
          function(obj){ scriptNodes.push(obj); }
        );

        //Execute scripts
        for(var i=0;i<scriptNodes.length;i++){
          var scriptNode = scriptNodes[i];
          var scriptBody = (scriptNode.textContent || '').trim();
          var scriptType = (scriptNode.getAttribute('type') || '').trim();
          var scriptSrc = (scriptNode.getAttribute('src') || '').trim();
          if(scriptType && (scriptType.indexOf('javascript')<0) && (scriptType.indexOf('ecmascript')<0)) continue;
          if(scriptSrc){
            //Download Script
            _this.loadScriptSync(scriptSrc);
          }
          else{
            //Eval Script
            if(_this.beginsWith(scriptBody,'<![CDATA[', true)){
              scriptBody = _this.trimToken(scriptBody, '<![CDATA[', 'start', 1, true);
              scriptBody = _this.trimToken(scriptBody, ']]>', 'end', 1);
            }
            if(_this.beginsWith(scriptBody,'<!--')){
              scriptBody = _this.trimToken(scriptBody, '<!--', 'start', 1);
              scriptBody = _this.trimToken(scriptBody, '-->', 'end', 1);
            }
            _this.evalWindow(scriptBody);
          }
        }
      }

      this.removeElement = function(id){
        var elem = document.getElementById(id);
        if(elem && elem.parentNode) elem.parentNode.removeChild(elem);
      }

      this.appendCss = function(id, css){
        var style = document.createElement('style');
        style.type = 'text/css';
        style.media = 'all';
        if(id) style.id = id;
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
      }

      this.appendRenderCss = function(){
        _this.appendCss('jshcms_render_styles', ['.jshcms_onrender_hide { display: none !important; }'].join(''));
      }

      this.appendTag = function(container, tagtype, attributes){
        var tag = document.createElement(tagtype);
        for(var key in attributes) tag[key] = attributes[key];
        container.appendChild(tag);
      }

      this.appendIframe = function(container, id, url){
        var obj = document.createElement('iframe');
        if(id) obj.id = id;
        obj.style.backgroundColor = 'rgba(255,255,255,1)';
        obj.style.position = 'fixed';
        obj.style.top = '0px';
        obj.style.left = '0px';
        obj.style.bottom = '0px';
        obj.style.width = '100%';
        obj.style.height = '100%';
        obj.style.border = '0';
        obj.style.zIndex = 2147483643;
        obj.src = url;
        container.appendChild(obj);
      }

      this.fade = function(id, obj, direction, duration, delay, step){
        if(id in _this.timers) window.clearTimeout(_this.timers[id]);
        if(delay){ _this.timers[id] = setTimeout(function(){ _this.fade(id, obj, direction, duration, 0, step) }, delay); return; }
        var FRAMES = (duration / 100);
        if(typeof step == 'undefined') step = Math.round(((direction==1) ? obj.style.opacity : (1-obj.style.opacity)) * FRAMES);
        obj.style.opacity = (direction==1) ? (step / FRAMES) : (1 - step / FRAMES);
        if(step >= FRAMES){
          if(direction==-1) obj.style.display = 'none';
        }
        else {
          _this.timers[id] = setTimeout(function(){ _this.fade(id, obj, direction, duration, 0, step+1); }, duration / FRAMES);
        }
      }

      this.fadeIn = function(id, obj, duration, delay, step){ _this.fade(id, obj, 1, duration, delay, step); }
      this.fadeOut = function(id, obj, duration, delay, step){ _this.fade(id, obj, -1, duration, delay, step); }

      //Utility - Loader
      //----------------

      this.startLoading = function(obj, options){
        options = _this.extend({
          fadeIn: false,
        }, options);
        var foundObj = false;
        for(var i=0;i<this.loadQueue.length;i++){ if(obj===this.loadQueue[i]) foundObj = true; }
        if(!foundObj) this.loadQueue.push(obj);

        if(this.isLoading) return;
        this.isLoading = true;

        var loader_obj = document.getElementById('jsHarmonyCMSClientLoading');

        if(loader_obj){
          loader_obj.style.opacity = (options.fadeIn ? 0 : 1);
          loader_obj.style.display = 'block';
          if(options.fadeIn) _this.fadeIn('jsHarmonyCMSClientLoading', loader_obj, 1000, 500);
        }
        else {
          _this.liveRender(
            function(){ if(document && document.body) return [document.body]; return []; },
            function(obj){
              loader_obj = document.createElement('div');
              loader_obj.id = 'jsHarmonyCMSClientLoading';
              loader_obj.style.backgroundColor = 'rgba(255,255,255,1)';
              loader_obj.style.position = 'fixed';
              loader_obj.style.top = '0px';
              loader_obj.style.left = '0px';
              loader_obj.style.bottom = '0px';
              loader_obj.style.width = '100%';
              loader_obj.style.zIndex = 2147483643;
              loader_obj.style.cursor = 'wait';
              loader_obj.style.opacity = (options.fadeIn ? 0 : 1);
              document.body.appendChild(loader_obj);

              var loader_img_container = document.createElement('div');
              loader_img_container.style.position = 'absolute';
              loader_img_container.style.top = '50%';
              loader_img_container.style.left = '50%';
              loader_obj.appendChild(loader_img_container);

              var loader_img = document.createElement('img');
              loader_img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzgiIGhlaWdodD0iMzgiIHZpZXdCb3g9IjAgMCAzOCAzOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiBzdHJva2U9IiNhYWEiPg0KICAgIDxnIGZpbGw9Im5vbmUiIGZpbGwtcnVsZT0iZXZlbm9kZCI+DQogICAgICAgIDxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDEgMSkiIHN0cm9rZS13aWR0aD0iMiI+DQogICAgICAgICAgICA8Y2lyY2xlIHN0cm9rZS1vcGFjaXR5PSIuNSIgY3g9IjE4IiBjeT0iMTgiIHI9IjE4Ii8+DQogICAgICAgICAgICA8cGF0aCBkPSJNMzYgMThjMC05Ljk0LTguMDYtMTgtMTgtMTgiPg0KICAgICAgICAgICAgICAgIDxhbmltYXRlVHJhbnNmb3JtDQogICAgICAgICAgICAgICAgICAgIGF0dHJpYnV0ZU5hbWU9InRyYW5zZm9ybSINCiAgICAgICAgICAgICAgICAgICAgdHlwZT0icm90YXRlIg0KICAgICAgICAgICAgICAgICAgICBmcm9tPSIwIDE4IDE4Ig0KICAgICAgICAgICAgICAgICAgICB0bz0iMzYwIDE4IDE4Ig0KICAgICAgICAgICAgICAgICAgICBkdXI9IjFzIg0KICAgICAgICAgICAgICAgICAgICByZXBlYXRDb3VudD0iaW5kZWZpbml0ZSIvPg0KICAgICAgICAgICAgPC9wYXRoPg0KICAgICAgICA8L2c+DQogICAgPC9nPg0KPC9zdmc+';
              loader_img.style.height = '100px';
              loader_img.style.width = '100px';
              loader_img.style.position = 'relative';
              loader_img.style.top = '-50px';
              loader_img.style.left = '-50px';
              loader_img_container.appendChild(loader_img);

              if(options.fadeIn) _this.fadeIn('jsHarmonyCMSClientLoading', loader_obj, 1000, 500);
            },
            { addClass: false }
          );
        }
      }

      this.stopLoading = function(obj){
        for(var i=0;i<this.loadQueue.length;i++){ if(obj===this.loadQueue[i]){ this.loadQueue.splice(i, 1); i--; } }
        if(this.loadQueue.length) return;

        this.isLoading = false;
        _this.fadeOut('jsHarmonyCMSClientLoading', document.getElementById('jsHarmonyCMSClientLoading'), 500);
      }

      //Bind Events
      //-----------

      window.addEventListener('message', function(e){
        if(e && e.data=='jshcms_isInProxy'){
          var proxyObj = document.getElementById('jsHarmonyCMSClientProxy');
          if(proxyObj) proxyObj.contentWindow.postMessage('jshcms_isInProxy_Confirmed');
        }
        else if(e && e.data=='jshcms_isInProxy_Confirmed'){
          if(_this.onProxyConfirmed) _this.onProxyConfirmed();
        }
      });


      //Call Constructor
      _GET = _this.parseGET();
      if (_this.auto_init) _this.onInit();
    }
    return jsHarmonyCmsClient;
  })();

  var sysSelf = (typeof self != 'undefined') && self || {};
  var sysGlobal = ((typeof global != 'undefined') && global) || sysSelf;
  var sysModule = (typeof module != 'undefined') && module;

  if(sysModule) sysModule.exports = exports = jsHarmonyCmsClient;
  if(!('jsHarmonyCmsClient' in sysGlobal)) sysGlobal.jsHarmonyCmsClient = jsHarmonyCmsClient;
  if(!('jsHarmonyCmsClient' in sysSelf)) sysSelf.jsHarmonyCmsClient = jsHarmonyCmsClient;
  return jsHarmonyCmsClient;

}).call(this);