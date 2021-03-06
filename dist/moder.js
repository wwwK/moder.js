/*
 * moder.js v0.2.9
 *
 * @file        moder.js 
 * @description Front-end Module (locale) Loader. 
 * @license     MIT License
 * @author      Pandao
 * {@link       https://github.com/pandao/moder.js}
 * @updateTime  2016-06-16
 */

var require, define;

// From: https://gist.github.com/Phinome/0eae8e374bb8229e94ea
// 解决隐私模式下 localStorage 不正常问题
;(function() {
    if (!localStorage) {
        return false;
    }

    var KEY = '_localStorage_', VALUE = 'test';

    // 检测是否正常
    try {
        localStorage.setItem(KEY, VALUE);
    } catch(e) {
        var noop = function() {};

        localStorage.__proto__ = {
            setItem: noop,
            getItem: noop,
            removeItem: noop,
            clear: noop
        };
    }

    // 删除测试数据
    if (localStorage.getItem(KEY) === VALUE) {
        localStorage.removeItem(KEY);
    }
})();

(function(global) {
    // 避免重复加载而导致已定义模块丢失
    if (window.require) {
        return ;
    }
    
    /**
     * 判断对象是否为函数
     * 
     * @param  {Mixed}   fn   判断对象
     * @return {Boolean} bool 返回一个布尔值
     */

    function isFunction(fn) {
        return (typeof fn === "function");
    }
    
    /**
     * 判断对象是否为字符串
     * 
     * @param  {Mixed}   str   判断对象
     * @return {Boolean} bool  返回一个布尔值
     */

    function isString(str) {
        return (typeof str === "string");
    }
    
    /**
     * 判断是否为 JS 文件
     * 
     * @param  {String}   url   模块 URL 地址
     * @return {Boolean}  bool  返回一个布尔值
     */

    function isJSFile(url) {
        return /\.js$/.test(url);
    }
    
    /**
     * 判断是否为 CSS 文件
     * 
     * @param  {String}   url   模块 URL 地址
     * @return {Boolean}  bool  返回一个布尔值
     */

    function isCSSFile(url) {
        return /\.css$/.test(url);
    }

    var _map        = {},
        cssMap      = {},
        resMap      = {},
        pkgMap      = {},
        loadingMap  = {},
        factoryMap  = {},
        modulesMap  = {},
        scriptsMap  = {},
        logPrefix   = "[Moder.js]",
        localPrefix = '',             // 本地存储模块名 ID 的前缀，为了避免同名 Key 造成数据不对称
                                      // 需在未加载任何模块前设置
                                      // 慎用或不随意变动，如果有变动，必须执行 localStorage.clear() 方法，
                                      // 否则会造成旧模块 ID Key 占用额外本地存储空间，无法同步更新
        head        = document.getElementsByTagName('head')[0];

    /**
     * 通过 Ajax 或 LocalStorage 加载，获取模块文件内容
     * 
     * @param  {String}    id        模块 ID
     * @param  {String}    url       模块文件地址
     * @param  {Function}  callback  加载完成后的回调处理函数
     * @return {Void}      void      无返回值
     */

    function ajaxLoader(id, url, callback) {
        if (url in scriptsMap) return ;

        var content,
            store        = localStorage,
            localId      = require.localPrefix + id;
        
        scriptsMap[url] = true;

        if (store && (content = store.getItem(url))) {
            if (!store.getItem(localId)) {
                store.setItem(localId, url);
            }

            callback(content);
        } else {
            var xhr = new XMLHttpRequest();

            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4 ) {
                    if (xhr.status === 200) {
                        content = xhr.responseText;
                        
                        if (store) {
                            var oldUrl = store.getItem(localId);

                            if (oldUrl) {
                                store.removeItem(oldUrl);
                            }
                            
                            store.setItem(url, content);
                            store.setItem(localId, url);
                        }

                        callback(content);
                    } else {
                        throw new Error(logPrefix + ' A unkown error occurred at ' + id);
                    }
                }
            };

            xhr.open("get", require.baseUrl + url);
            xhr.send(null);
        }
    }

    /**
     * 加载脚本文件
     * 
     * @param  {String}      url       模块文件 URL
     * @param  {Function}    onerror   加载失败或错误后的回调处理函数
     * @return {HTMLElement} script    返回 Script 元素对象
     */ 

    function loadScript(url, onerror) {
        if (url in scriptsMap) return ;

        scriptsMap[url] = true;

        var script = document.createElement('script');
        
        if (onerror) {
            var tid = setTimeout(onerror, require.timeout);

            script.onerror = function (e) {
                clearTimeout(tid);
                onerror(e);
            };

            var onload = function () {
                clearTimeout(tid);
                onerror();
            };

            if ('onload' in script) {
                script.onload = onload;
            } else {
                script.onreadystatechange = function () {
                    if (this.readyState === 'loaded' || 
                        this.readyState === 'complete') {
                        onload();
                    }
                };
            }
        }
        
        script.type = 'text/javascript';
        script.src  = require.baseUrl + url;
        head.appendChild(script);

        return script;
    }

    /**
     * 模块文件加载器
     * 
     * @param  {String}    id        模块 ID
     * @param  {Function}  callback  加载完成后的回调处理函数
     * @param  {Function}  onerror   加载失败或错误后的回调处理函数
     * @return {Void}      void      无返回值
     */ 

    function loader(id, callback, onerror) {
        var queue = loadingMap[id] || (loadingMap[id] = []);

        queue.push(callback);

        var url,
            res = resMap[id] || {},
            pkg = res.pkg;

        if (pkg) {
            url = pkgMap[pkg].url;
        } else {
            url = res.url || id;
        }

        if (require.saveToLocalStorage)
        {
            ajaxLoader(id, url, function(content) {
                if (isCSSFile(url)) {
                    if (cssMap[url]) return ;

                    cssMap[url] = true;
                
                    require.loadCSS({content : content});
                    return ;
                }
                
                script = document.createElement('script');
                script.type      = 'text/javascript';
                script.innerHTML = content;
                head.appendChild(script);
            });
        } 
        else
        {
            if (isCSSFile(url)) {
                require.loadCSS({url : url});
                return ;
            }

            loadScript(url, onerror && function() {
                onerror(id);
            });
        }
    }
    
    /**
     * 模块定义方法
     * 
     * @param  {String}    id        模块 ID
     * @param  {Function}  factory   实现模块的闭包函数
     * @return {Void}      void      无返回值
     */

    define = function(id, factory) {
        factoryMap[id] = factory;

        var queue = loadingMap[id];

        if (queue) {
            for(var i = 0, n = queue.length; i < n; i++) {
                queue[i]();
            }

            delete loadingMap[id];
        }
    };
    
    /**
     * AMD 规范标识对象
     */

    define.amd = {
        jQuery  : true,
        version : '0.2.9'
    };

    /**
     * 请求模块方法
     * 
     * @param  {String|Array}    id        请求的模块 ID 或模块 ID 数组
     * @return {Mixed}           mixed     返回模块
     */

    require = function(id) {
        if (id && id.splice) {
            return require.async.apply(this, arguments);
        }

        var module = modulesMap[id];

        if (module) {
            return module.exports;
        }

        var factory = factoryMap[id];

        if (!factory) {
            throw new Error(logPrefix + ' Cannot find module `' + id + '`');
        }

        module = modulesMap[id] = {
            exports: {}
        };

        var ret = isFunction(factory) ? factory.apply(module, [require, module.exports, module]) 
                                      : factory;

        if (ret) {
            module.exports = ret;
        }
        
        return module.exports;
    };
    
    /**
     * 同步请求模块方法
     * 
     * @param  {String|Array}    names     请求的模块 ID 或模块 ID 数组
     * @param  {Function}        onload    加载成功后的回调处理函数
     * @param  {Function}        onerror   加载失败或出错后的回调处理函数
     * @return {Mixed}           mixed     返回模块
     */

    require.load = require.async = function(names, onload, onerror) {
        if (isString(names)) {
            names = [names];
        }

        var needMap = {}, needNum = 0;

        function findNeed(depArr) {
            
            var child;

            for (var i = 0, n = depArr.length; i < n; i++) {
                //
                // skip loading or loaded
                //
                var dep = depArr[i];

                if (dep in needMap) {
                    continue;
                }

                needMap[dep] = true;
                
                if (dep in factoryMap) {
                    // check whether loaded resource's deps is loaded or not
                    child = resMap[dep] || resMap[dep + '.js'];
                    if (child && 'deps' in child) {
                        findNeed(child.deps);
                    }
                    continue;
                }
                
                needNum++;
                loader(dep, updateNeed, onerror);

                child = resMap[dep] || resMap[dep + '.js'];
                if (child && 'deps' in child) {
                    findNeed(child.deps);
                }
            }
        }

        function updateNeed() {
            if (0 == needNum--) {
                var args = [];

                for(var i = 0, n = names.length; i < n; i++) {
                    args[i] = require(names[i]);
                }

                onload && onload.apply(global, args);
            }
        }
        
        findNeed(names);
        updateNeed();
    };
    
    /**
     * 定义模块 Map 方法
     * 
     * @param  {String|Object}   obj     模块 Map 键值对对象或 JSON String
     * @return {Void}            void    无返回值
     */

    require.map = function(obj) {
        var key, col;
        
        _map = obj;

        col = obj.res;

        for (key in col) {
            if (col.hasOwnProperty(key)) {
                resMap[key] = col[key];
            }
        }

        col = obj.pkg;

        for (key in col) {
            if (col.hasOwnProperty(key)) {
                pkgMap[key] = col[key];
            }
        }
    };

    /**
     * 加载脚本文件（别名）
     * 
     * @param  {String}      url       模块文件 URL
     * @param  {Function}    onerror   加载失败或错误后的回调处理函数
     * @return {HTMLElement} script    返回 Script 元素对象
     */ 

    require.preload = require.loadJS = require.loadScript = loadScript;

    /**
     * 加载 CSS 样式文件
     * 
     * @param  {Object}     config    加载配置
     * @param  {Function}   callback  加载成功后的回调处理函数
     * @return {Void}       void      无返回值
     */ 

    require.loadCSS = function(config, callback) {
        callback = callback || function() {};

        if (config.content) {
            var style  = document.createElement('style');
            style.type = 'text/css';
            
            if (style.styleSheet) { // for IE
                style.styleSheet.cssText = config.content;
            } else {
                style.innerHTML = config.content;
            }

            head.appendChild(style);
            callback();
        }
        else if (config.url) {
            if (cssMap[config.url]) return ;

            cssMap[config.url] = true;
            
            var link  = document.createElement('link');

            link.onload = function() {
                callback();
            };

            link.href = config.url;
            link.rel  = 'stylesheet';
            link.type = 'text/css';
            head.appendChild(link);
        }
    };
    
    /**
     * 本地存储模块 Map 的 Key
     */

    require.mapVersionKey = "module_map_version";
    
    /**
     * 存储模块 Map 的版本号，用于判断并及时更新本地存储
     * 
     * @param  {String|Int}  version  本地存储模块 Map 的版本
     * @return {Void}        void     无返回值
     */

    require.setMapVersion = function(version) {
        if (!localStorage) return false;

        localStorage.setItem(require.localPrefix + require.mapVersionKey, version);
    };
    
    /**
     * 获取模块 Map 的版本号
     * 
     * @return {String}      version  返回本地存储的模块 Map 版本号
     */

    require.getMapVersion = function() {
        if (!localStorage) return false;

        return localStorage.getItem(require.localPrefix + require.mapVersionKey);
    };
    
    /**
     * 获取本地存储
     * 
     * @param   {String}   key    本地存储键
     * @returns {boolean}  mixed  返回本地存储的键值
     */

    require.getItem = function(key) {
        if (!localStorage) return false;
        return localStorage.getItem(key);
    };
    
    /**
     * 设置本地存储d
     * 
     * @param   {String}   key      本地存储键
     * @param   {String}   value    本地存储键值
     * @return  {Void}     void     返回本地存储的键值
     */

    require.setItem = function(key, value) {
        if (!localStorage) return false;
        localStorage.setItem(key, value);
    };
    
    /**
     * 移除本地存储
     * 
     * @param   {String}   key      本地存储键
     * @returns {boolean}  mixed    返回结果
     */

    require.removeItem = function(key) {
        if (!localStorage) return false;
        return localStorage.removeItem(key);
    };
    
    /**
     * 清空本地存储的模块
     * 
     * 注：不会清除 Map version
     * 
     * @return {Void}   void   无返回值
     */

    require.clear = require.clearLocalStorage = function() {
        if (!localStorage) return false;

        for (var i in _map) {
            for (var m in _map[i]) {
                var name    = require.localPrefix + m;
                var fileKey = localStorage.getItem(name);

                localStorage.removeItem(name);
                localStorage.removeItem(fileKey);
            }
        }
    };

    /**
     * 请求超时时间，单位毫秒
     */ 

    require.timeout = 5000;
    
    /**
     * 是否将模块存储为本地存储
     */

    require.saveToLocalStorage = true;
    
    /**
     * 本地存储模块名 ID Key 前缀，默认为空，该设置需在未加载任何模块前设置
     */

    require.localPrefix = localPrefix;
    
    /**
     * 资源 URL 基本路径
     * 
     * 主要用于避免存储过长的 URL
     */ 
    
    require.baseUrl = "";

})(this);