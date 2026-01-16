// ==UserScript==
// @name         Bilibili AI Subtitle Batch Downloader
// @namespace    http://tampermonkey.net/
// @version      1.10
// @description  批量下载B站视频合集/列表的AI中文字幕，支持MD/TXT/LRC/SRT格式，集成并发控制与重试机制。
// @author       Cooper.X.Oak
// @match        https://www.bilibili.com/video/*
// @icon         https://www.bilibili.com/favicon.ico
// @require      https://cdn.bootcdn.net/ajax/libs/spark-md5/3.0.2/spark-md5.min.js
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        GM_addStyle
// @grant        unsafeWindow
// @connect      bilibili.com
// @connect      hdslb.com
// @downloadURL  https://github.com/Cooper-X-Oak/bilibili-subtitle-downloader/raw/main/bilibili_subtitle_downloader.user.js
// @updateURL    https://github.com/Cooper-X-Oak/bilibili-subtitle-downloader/raw/main/bilibili_subtitle_downloader.user.js
// @license      MIT
// ==/UserScript==

// 创建原委：解决B站合集视频AI字幕无法批量下载、只能逐个点击的痛点。v1.0正式版已发布，提供稳定、高效的批量下载体验。
// 用途：自动化提取 B 站视频列表（支持合集/列表/番剧），批量请求 WBI 签名接口获取字幕，支持转换为 MD/TXT/LRC/SRT 等多种格式并直接批量下载。提供智能多关键词筛选，及紧凑型 UI，极大提升批量获取字幕的效率。
// 风险说明：
// 1. 高并发请求可能触发 B 站风控（WBI 接口报错 403/412），脚本内置了智能并发控制（默认 3 并发）与指数退避重试机制来规避此风险。
// 2. 批量直接下载模式下，务必关闭浏览器的“下载前询问每个文件的保存位置”设置，否则会弹出大量保存对话框。

(function() {
    'use strict';
    const VERSION = '1.10';
    
    // 配置项==========================================
    // 0. 内联依赖库 (FileSaver.js) - 解决 CDN 不稳定问题
    // ==========================================
    /* FileSaver.js v2.0.4 */
    /* MIT License */
    var saveAs=saveAs||function(e){"use strict";if(typeof e==="undefined"||typeof navigator!=="undefined"&&/MSIE [1-9]\./.test(navigator.userAgent)){return}var t=e.document,n=function(){return e.URL||e.webkitURL||e},r=t.createElementNS("http://www.w3.org/1999/xhtml","a"),o="download"in r,a=function(e){var t=new MouseEvent("click");e.dispatchEvent(t)},i=/constructor/i.test(e.HTMLElement)||e.safari,f=/CriOS\/[\d]+/.test(navigator.userAgent),u=function(t){(e.setImmediate||e.setTimeout)(function(){throw t},0)},s="application/octet-stream",d=1e3*40,c=function(e){var t=function(){if(typeof e==="string"){n().revokeObjectURL(e)}else{e.remove()}};setTimeout(t,d)},l=function(e,t,n){t=[].concat(t);var r=t.length;while(r--){var o=e["on"+t[r]];if(typeof o==="function"){try{o.call(e,n||e)}catch(a){u(a)}}}},p=function(e){if(/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(e.type)){return new Blob([String.fromCharCode(65279),e],{type:e.type})}return e},v=function(t,u,d){if(!d){t=p(t)}var v=this,w=t.type,m=w===s,y,h=function(){l(v,"writestart progress write writeend".split(" "))},S=function(){if((f||m&&i)&&e.FileReader){var r=new FileReader;r.onloadend=function(){var t=f?r.result:r.result.replace(/^data:[^;]*;/,"data:attachment/file;");var n=e.open(t,"_blank");if(!n)e.location.href=t;t=undefined;v.readyState=v.DONE;h()};r.readAsDataURL(t);v.readyState=v.INIT;return}if(!y){y=n().createObjectURL(t)}if(m){e.location.href=y}else{var o=e.open(y,"_blank");if(!o){e.location.href=y}}v.readyState=v.DONE;h();c(y)};v.readyState=v.INIT;if(o){y=n().createObjectURL(t);setTimeout(function(){r.href=y;r.download=u;a(r);h();c(y);v.readyState=v.DONE});return}S()},w=v.prototype,m=function(e,t,n){return new v(e,t||e.name||"download",n)};if(typeof navigator!=="undefined"&&navigator.msSaveOrOpenBlob){return function(e,t,n){t=t||e.name||"download";if(!n){e=p(e)}return navigator.msSaveOrOpenBlob(e,t)}}w.abort=function(){};w.readyState=w.INIT=0;w.WRITING=1;w.DONE=2;w.error=w.onwritestart=w.onprogress=w.onwrite=w.onabort=w.onerror=w.onwriteend=null;return m}(typeof self!=="undefined"&&self||typeof window!=="undefined"&&window||this.content);
    // ==========================================

    // ==========================================
    // 1. 样式定义 (UI Styles)
    // ==========================================
    const STYLES = `
        #bili-sub-downloader-btn {
            position: fixed;
            top: 200px;
            right: 0;
            z-index: 10001;
            background: linear-gradient(135deg, #FF69B4, #00AEEC);
            color: #fff;
            padding: 12px 18px;
            border-radius: 25px 0 0 25px;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0, 174, 236, 0.4);
            font-size: 15px;
            font-weight: bold;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
            transition: right 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28), padding 0.3s ease, transform 0.3s ease; /* 优化 transition 性能 */
            border: 2px solid rgba(255,255,255,0.3);
            border-right: none;
            display: flex;
            align-items: center;
            gap: 5px;
            will-change: right, padding, transform; /* 提示浏览器提前优化渲染层 */
        }
        #bili-sub-downloader-btn:hover {
            right: -5px;
            padding-right: 25px;
            box-shadow: 0 6px 20px rgba(255, 105, 180, 0.6);
            transform: scale(1.05);
        }
        #bili-sub-downloader-panel {
            position: fixed;
            top: 100px;
            right: -400px;
            width: 380px;
            height: auto;
            max-height: 90vh;
            background: #fff;
            z-index: 10002;
            box-shadow: -2px 0 10px rgba(0,0,0,0.2);
            transition: right 0.3s;
            border-radius: 5px 0 0 5px;
            display: flex;
            flex-direction: column;
            font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
            padding-top: 10px;
        }
        #bili-sub-downloader-panel.open {
            right: 0;
        }
        .bsd-close {
            position: absolute;
            top: 8px;
            right: 12px;
            cursor: pointer;
            color: #999;
            font-size: 24px;
            z-index: 10010;
            line-height: 1;
        }
        .bsd-close:hover {
            color: #333;
        }
        .bsd-content {
            flex: 1;
            overflow-y: auto;
            padding: 0;
            min-height: 200px;
        }
        .bsd-content::-webkit-scrollbar {
            width: 12px;
        }
        .bsd-content::-webkit-scrollbar-thumb {
            background-color: #ccc;
            border-radius: 6px;
            border: 2px solid #fff;
        }
        .bsd-content::-webkit-scrollbar-thumb:hover {
            background-color: #999;
        }
        /* 筛选栏样式 */
        .bsd-filter-bar {
            padding: 8px 10px;
            background: #fff;
            border-bottom: 1px solid #eee;
            display: flex;
            gap: 8px;
            flex-direction: row;
            align-items: center;
        }
        .bsd-filter-row {
            display: flex;
            gap: 5px;
            flex: 1;
        }
        .bsd-filter-input {
            flex: 1;
            padding: 6px 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 12px;
            outline: none;
            transition: border-color 0.2s;
        }
        .bsd-filter-input:focus {
            border-color: #00AEEC;
        }
        .bsd-filter-btn {
            padding: 4px 10px;
            background: #f6f6f6;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            color: #555;
            white-space: nowrap;
        }
        .bsd-filter-btn:hover {
            background: #e9e9e9;
            color: #00AEEC;
            border-color: #bce0f0;
        }
        .bsd-filter-stat {
            font-size: 11px;
            color: #999;
            white-space: nowrap;
        }

        .bsd-footer {
            padding: 10px;
            padding-bottom: 20px;
            border-top: 1px solid #eee;
            background: #f8f8f8;
            display: flex;
            flex-direction: column;
            flex-shrink: 0;
        }
        .bsd-ctrl-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
            margin-bottom: 8px;
            color: #666;
        }
        .bsd-format-select {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .bsd-format-select select {
            padding: 2px;
            border-radius: 3px;
            border: 1px solid #ddd;
            font-size: 12px;
            outline: none;
        }
        .bsd-btn-row {
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
        }
        .bsd-btn {
            background: #00AEEC;
            color: white;
            border: none;
            padding: 8px 0;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            text-align: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            flex: 1;
        }
        .bsd-btn:disabled {
            background: #ccc;
            cursor: not-allowed;
            box-shadow: none;
        }
        .bsd-btn.secondary {
            background: #fff;
            color: #666;
            border: 1px solid #ddd;
        }
        .bsd-video-item {
            display: flex;
            align-items: center;
            padding: 1px 2px;
            border-bottom: 1px solid #f0f0f0;
            gap: 2px;
            min-height: 20px;
            transition: background 0.2s;
        }
        .bsd-video-item:hover {
            background: #f0faff;
        }
        .bsd-video-item input[type="checkbox"] {
            margin: 0;
            width: 12px;
            height: 12px;
            cursor: pointer;
        }
        .bsd-video-index {
            width: 30px;
            font-size: 12px;
            color: #555;
            text-align: center;
            flex-shrink: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-variant-numeric: tabular-nums; /* 等宽数字，对齐更好 */
        }
        .bsd-video-status-col {
            width: 16px;
            text-align: center;
            font-size: 12px;
            flex-shrink: 0;
            cursor: default;
            margin: 0;
            padding: 0;
        }
        .bsd-video-title {
            font-size: 12px;
            color: #333;
            line-height: 1.2;
            word-break: break-all;
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        .bsd-status {
            font-size: 12px;
            color: #666;
            margin-top: 5px;
            text-align: left;
            background: #eee;
            padding: 6px;
            border-radius: 4px;
            height: 60px;
            overflow-y: auto;
            white-space: pre-wrap;
            border: 1px solid #ddd;
        }
        .bsd-progress-container {
            width: 100%;
            height: 4px;
            background: #eee;
            margin-top: 5px;
            border-radius: 2px;
            overflow: hidden;
            display: none;
        }
        .bsd-progress-bar {
            height: 100%;
            background: #00AEEC;
            width: 0%;
            transition: width 0.3s;
        }
        .bsd-hidden {
            display: none !important;
        }
        .bsd-highlight {
            background-color: #e0f7fa; /* 筛选高亮色 */
        }
        .bsd-selected {
            background-color: #fffde7 !important; /* 选中高亮色 */
        }
        .bsd-video-title.failed {
            color: red !important; /* 失败标题标红 */
        }
    `;

    // ==========================================
    // 2. 基础 UI 注入 (UI Injection)
    // ==========================================
    function initUI() {
        // 延迟注入，避免阻塞首屏关键资源加载
        if (document.readyState !== 'loading') {
            injectElements();
        } else {
            document.addEventListener('DOMContentLoaded', injectElements);
        }
    }

    function injectElements() {
        GM_addStyle(STYLES);

        const toggleBtn = document.createElement('div');
        toggleBtn.id = 'bili-sub-downloader-btn';
        toggleBtn.innerText = '✨AI字幕神器';
        document.body.appendChild(toggleBtn);

        const panel = document.createElement('div');
        panel.id = 'bili-sub-downloader-panel';
        panel.innerHTML = `
            <span class="bsd-close">×</span>
            
            <!-- Combined Warning -->
            <div style="background: #fff3cd; color: #856404; padding: 12px 15px; font-size: 12px; border-bottom: 1px solid #ffeeba; line-height: 1.5;">
                <b>⚠️ 重要提示：</b>本工具仅提取B站<b>官方AI/CC字幕</b>，不支持转录。<br>
                批量下载前，请务必<b>关闭浏览器的“下载前询问每个文件的保存位置”</b>设置，否则会弹出大量保存对话框。
            </div>
            
            <!-- Filter Bar -->
            <div class="bsd-filter-bar">
                <div class="bsd-filter-row">
                    <input type="text" class="bsd-filter-input" id="bsd-filter-input" placeholder="输入关键词 (空格分隔, OR匹配)">
                    <button class="bsd-filter-btn" id="bsd-filter-select-btn" title="选中所有符合当前筛选条件的视频">选中筛选结果</button>
                    <button class="bsd-filter-btn" id="bsd-select-failed-btn" title="选中所有下载失败的视频">选中失败</button>
                </div>
                <div class="bsd-filter-stat" id="bsd-filter-stat"></div>
            </div>

            <div class="bsd-content" id="bsd-list-container">
                <div style="text-align:center; color:#999; margin-top:20px;">
                    点击“刷新”获取列表
                </div>
            </div>
            <div class="bsd-footer">
                <!-- 控制行: 全选 | 计数 | 格式 -->
                <div class="bsd-ctrl-row">
                     <label style="cursor:pointer; display:flex; align-items:center;">
                        <input type="checkbox" id="bsd-select-all" style="vertical-align:middle; margin-right:4px;"> 全选
                     </label>
                     <span id="bsd-count">已选: 0</span>
                     <div class="bsd-format-select">
                        <span>格式:</span>
                        <select id="bsd-format">
                            <option value="md" selected>MD</option>
                            <option value="txt">TXT</option>
                            <option value="lrc">LRC</option>
                            <option value="srt">SRT</option>
                        </select>
                     </div>
                </div>
                
                <!-- 按钮行 -->
                <div class="bsd-btn-row">
                    <button class="bsd-btn secondary" id="bsd-load-btn">刷新列表</button>
                    <button class="bsd-btn" id="bsd-download-btn" disabled>开始下载</button>
                </div>

                <div class="bsd-progress-container" id="bsd-progress-wrap">
                    <div class="bsd-progress-bar" id="bsd-progress-bar"></div>
                </div>
                <div class="bsd-status" id="bsd-status-text">就绪</div>
            </div>
        `;
        document.body.appendChild(panel);

        // 事件绑定
        toggleBtn.addEventListener('click', () => {
            panel.classList.add('open');
            toggleBtn.style.right = '-100px';
        });

        panel.querySelector('.bsd-close').addEventListener('click', () => {
            panel.classList.remove('open');
            toggleBtn.style.right = '0';
        });

        document.getElementById('bsd-load-btn').addEventListener('click', loadVideoList);
        document.getElementById('bsd-download-btn').addEventListener('click', startBatchDownload);
        
        // 筛选逻辑绑定
        const filterInput = document.getElementById('bsd-filter-input');
        const selectMatchBtn = document.getElementById('bsd-filter-select-btn');
        const selectFailedBtn = document.getElementById('bsd-select-failed-btn');
        
        filterInput.addEventListener('input', filterVideos);
        selectMatchBtn.addEventListener('click', selectMatchingVideos);
        selectFailedBtn.addEventListener('click', selectFailedVideos);
        
        document.getElementById('bsd-select-all').addEventListener('change', (e) => {
            // 全选当前列表中的所有项 (v0.20: 不再受筛选影响，因为筛选不再隐藏)
            const allItems = document.querySelectorAll('.bsd-video-item');
            allItems.forEach(item => {
                const cb = item.querySelector('input[type="checkbox"]');
                if (cb) cb.checked = e.target.checked;
            });
            updateSelectionCount();
        });
    }

    // ==========================================
    // 3. 核心逻辑实现
    // ==========================================
    
    function filterVideos() {
        const input = document.getElementById('bsd-filter-input');
        const stat = document.getElementById('bsd-filter-stat');
        const keywords = input.value.trim().toLowerCase().split(/\s+/).filter(k => k);
        const items = document.querySelectorAll('.bsd-video-item');
        
        if (items.length === 0) {
            stat.innerText = '';
            return;
        }

        let matchCount = 0;
        items.forEach(item => {
            const title = item.querySelector('.bsd-video-title').innerText.toLowerCase();
            // 检查任一关键词是否在标题中 (OR 逻辑)
            const isMatch = keywords.length > 0 && keywords.some(k => title.includes(k));
            
            // v0.20: 仅高亮匹配项，不隐藏任何项
            if (isMatch) {
                item.classList.add('bsd-highlight');
                matchCount++;
            } else {
                item.classList.remove('bsd-highlight');
            }
            
            // 确保移除可能残留的隐藏状态 (v0.19逻辑)
            item.classList.remove('bsd-hidden');
            item.style.display = ''; 
        });

        if (keywords.length > 0) {
            stat.innerText = `匹配: ${matchCount} / ${items.length}`;
        } else {
            stat.innerText = `总计: ${items.length}`;
            // 无关键词时清除高亮
            items.forEach(item => item.classList.remove('bsd-highlight'));
        }
        
        // 取消全选框的自动联动
        document.getElementById('bsd-select-all').checked = false;
    }

    function selectMatchingVideos() {
        const items = document.querySelectorAll('.bsd-video-item.bsd-highlight');
        if (items.length === 0) {
            logStatus('没有匹配项可选中');
            return;
        }
        
        let count = 0;
        items.forEach(item => {
            const cb = item.querySelector('input[type="checkbox"]');
            if (cb && !cb.checked) {
                cb.checked = true;
                count++;
            }
        });
        updateSelectionCount();
        logStatus(`已选中 ${count} 个匹配项`);
    }

    function selectFailedVideos() {
        const items = document.querySelectorAll('.bsd-video-item');
        let count = 0;
        
        // 先取消所有选中
        items.forEach(item => {
            const cb = item.querySelector('input[type="checkbox"]');
            if (cb) cb.checked = false;
        });
        
        // 再选中失败项
        items.forEach(item => {
            const statusCol = item.querySelector('.bsd-video-status-col');
            const cb = item.querySelector('input[type="checkbox"]');
            if (statusCol && statusCol.innerText.includes('❎') && cb) {
                cb.checked = true;
                count++;
            }
        });
        
        if (count === 0) {
            logStatus('没有发现下载失败的项目或已全部选中');
        } else {
            updateSelectionCount();
            logStatus(`已选中 ${count} 个失败项`);
        }
    }

    function formatTime(seconds) {
        const date = new Date(null);
        date.setMilliseconds(seconds * 1000);
        const result = date.toISOString().substr(11, 12).replace('.', ',');
        return result;
    }

    function formatTimeLrc(seconds) {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        const ms = Math.floor((seconds % 1) * 100).toString().padStart(2, '0');
        return `[${m}:${s}.${ms}]`;
    }

    function jsonToSrt(jsonBody) {
        if (!jsonBody || !jsonBody.body) return '';
        
        return jsonBody.body.map((item, index) => {
            const start = formatTime(item.from);
            const end = formatTime(item.to);
            const content = item.content;
            return `${index + 1}\n${start} --> ${end}\n${content}\n`;
        }).join('\n');
    }

    function jsonToTxt(jsonBody) {
        if (!jsonBody || !jsonBody.body) return '';
        return jsonBody.body.map(item => item.content).join('\n');
    }

    function jsonToLrc(jsonBody) {
        if (!jsonBody || !jsonBody.body) return '';
        return jsonBody.body.map(item => {
            const time = formatTimeLrc(item.from);
            return `${time}${item.content}`;
        }).join('\n');
    }

    function getBvidFromUrl() {
        const match = location.pathname.match(/\/video\/(BV\w+)/);
        return match ? match[1] : null;
    }

    // ==========================================
    // 4. WBI 签名模块
    // ==========================================
    const mixinKeyEncTab = [
        46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
        33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
        61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
        36, 20, 34, 44, 52
    ];

    function getMixinKey(orig) {
        let temp = '';
        mixinKeyEncTab.forEach((n) => {
            if (n < orig.length) {
                temp += orig[n];
            }
        });
        return temp.slice(0, 32);
    }

    function getWbiKeys() {
        return new Promise((resolve, reject) => {
            if (window._wbi_keys_cache) {
                resolve(window._wbi_keys_cache);
                return;
            }

            GM_xmlhttpRequest({
                method: "GET",
                url: "https://api.bilibili.com/x/web-interface/nav",
                onload: function(res) {
                    try {
                        const json = JSON.parse(res.responseText);
                        const img_url = json.data.wbi_img.img_url;
                        const sub_url = json.data.wbi_img.sub_url;
                        const keys = {
                            img_key: img_url.substring(img_url.lastIndexOf('/') + 1, img_url.lastIndexOf('.')),
                            sub_key: sub_url.substring(sub_url.lastIndexOf('/') + 1, sub_url.lastIndexOf('.'))
                        };
                        window._wbi_keys_cache = keys;
                        resolve(keys);
                    } catch (e) {
                        reject("获取 WBI Keys 失败");
                    }
                },
                onerror: function() {
                    reject("请求 nav 接口失败");
                }
            });
        });
    }

    function encWbi(params, img_key, sub_key) {
        const mixin_key = getMixinKey(img_key + sub_key);
        const curr_time = Math.round(Date.now() / 1000);
        const newParams = { ...params, wts: curr_time };
        const sortedKeys = Object.keys(newParams).sort();
        
        let query = sortedKeys.map(key => {
            return `${encodeURIComponent(key)}=${encodeURIComponent(newParams[key])}`;
        }).join('&');
        
        const w_rid = SparkMD5.hash(query + mixin_key);
        return { w_rid, wts: curr_time };
    }

    function fetchSeasonList(bvid) {
        return new Promise((resolve, reject) => {
            const url = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        if (data.code !== 0) {
                            reject(data.message);
                            return;
                        }
                        
                        let list = [];
                        if (data.data.ugc_season && data.data.ugc_season.sections) {
                             data.data.ugc_season.sections.forEach(sec => {
                                 if (sec.episodes) {
                                     list = list.concat(sec.episodes.map(ep => ({
                                         title: ep.title,
                                         bvid: ep.bvid,
                                         cid: ep.cid,
                                         aid: ep.aid
                                     })));
                                 }
                             });
                        } else if (data.data.pages) {
                            list = data.data.pages.map(p => ({
                                title: p.part,
                                bvid: bvid,
                                cid: p.cid,
                                aid: data.data.aid
                            }));
                        } else {
                             list.push({
                                 title: data.data.title,
                                 bvid: data.data.bvid,
                                 cid: data.data.cid,
                                 aid: data.data.aid
                             });
                        }
                        resolve(list);

                    } catch (e) {
                        reject(`解析列表失败: ${e.message}`);
                    }
                },
                onerror: function(err) {
                    reject(`请求列表失败: ${err.statusText}`);
                }
            });
        });
    }

    async function fetchSubtitleInfo(bvid, cid, retryCount = 0) {
        const MAX_RETRIES = 3;
        try {
            const keys = await getWbiKeys();
            const params = { bvid: bvid, cid: cid };
            const wbiData = encWbi(params, keys.img_key, keys.sub_key);
            
            const queryParams = new URLSearchParams({
                ...params,
                w_rid: wbiData.w_rid,
                wts: wbiData.wts
            });
            const url = `https://api.bilibili.com/x/player/wbi/v2?${queryParams.toString()}`;

            return await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: url,
                    timeout: 5000,
                    onload: function(response) {
                        try {
                            if (response.status !== 200) {
                                reject(new Error(`HTTP ${response.status}`));
                                return;
                            }

                            const data = JSON.parse(response.responseText);
                            if (data.code !== 0) {
                                reject(new Error(`API Error ${data.code}: ${data.message}`));
                                return;
                            }
                            
                            const subtitles = data.data.subtitle?.subtitles || [];
                            if (subtitles.length === 0) {
                                resolve(null);
                                return;
                            }

                            const targetSub = subtitles.find(s => s.lan === 'ai-zh') || subtitles.find(s => s.lan === 'zh-Hans') || subtitles[0];
                            
                            if (targetSub) {
                                let subUrl = targetSub.subtitle_url;
                                if (!subUrl && targetSub.url) subUrl = targetSub.url;

                                if (subUrl && subUrl.startsWith('//')) {
                                    subUrl = 'https:' + subUrl;
                                }
                                resolve(subUrl);
                            } else {
                                resolve(null);
                            }
                        } catch (e) {
                            reject(new Error(`Parse Error: ${e.message}`));
                        }
                    },
                    ontimeout: function() {
                        reject(new Error('Network Timeout'));
                    },
                    onerror: function(err) {
                        reject(new Error(`Network Error: ${err.statusText || 'Unknown'}`));
                    }
                });
            });
        } catch (e) {
            if (retryCount < MAX_RETRIES) {
                const delay = Math.pow(2, retryCount + 1) * 1000;
                console.warn(`[BiliSub] 获取字幕失败，${delay}ms 后重试 (${retryCount + 1}/${MAX_RETRIES})...`, e);
                await new Promise(r => setTimeout(r, delay));
                return fetchSubtitleInfo(bvid, cid, retryCount + 1);
            }
            throw e;
        }
    }

    async function downloadSubtitleJson(url, retryCount = 0) {
        const MAX_RETRIES = 3;
        try {
            return await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: url,
                    timeout: 10000, // 增加超时至 10s
                    onload: function(response) {
                        try {
                            if (response.status !== 200) {
                                reject(new Error(`HTTP ${response.status}`));
                                return;
                            }
                            const json = JSON.parse(response.responseText);
                            resolve(json);
                        } catch (e) {
                            reject(new Error(`JSON解析失败`));
                        }
                    },
                    ontimeout: function() {
                        reject(new Error('JSON下载超时'));
                    },
                    onerror: function(err) {
                        reject(new Error(`下载失败: ${err.statusText || 'Unknown'}`));
                    }
                });
            });
        } catch (e) {
            if (retryCount < MAX_RETRIES) {
                const delay = 1000 * (retryCount + 1);
                console.warn(`[BiliSub] JSON下载失败，${delay}ms 后重试 (${retryCount + 1}/${MAX_RETRIES})...`, e);
                await new Promise(r => setTimeout(r, delay));
                return downloadSubtitleJson(url, retryCount + 1);
            }
            throw e;
        }
    }

    async function loadVideoList() {
        logStatus('正在解析视频列表...');
        const container = document.getElementById('bsd-list-container');
        container.innerHTML = '<div style="text-align:center; padding:20px;">正在加载...</div>';

        const bvid = getBvidFromUrl();
        if (!bvid) {
            logStatus('未找到 BV 号');
            container.innerHTML = '<div style="text-align:center; padding:20px;">无法获取当前视频 BV 号</div>';
            return;
        }

        try {
            const videoList = await fetchSeasonList(bvid);
            container.innerHTML = ''; 

            if (videoList.length === 0) {
                logStatus('未找到视频列表');
                container.innerHTML = '<div style="text-align:center; padding:20px;">列表为空</div>';
                return;
            }

            videoList.forEach((v, index) => {
                const item = document.createElement('div');
                item.className = 'bsd-video-item';
                const safeTitle = v.title.replace(/[\\/:*?"<>|]/g, '_');
                
                item.innerHTML = `
                    <div class="bsd-video-status-col"></div>
                    <input type="checkbox" data-cid="${v.cid}" data-bvid="${v.bvid}" data-title="${safeTitle}" data-index="${index + 1}">
                    <div class="bsd-video-index">${index + 1}</div>
                    <div class="bsd-video-title" title="${v.title}">${v.title}</div>
                `;
                container.appendChild(item);
                item.querySelector('input').addEventListener('change', updateSelectionCount);
            });

            logStatus(`加载完成，共 ${videoList.length} 个视频`);
            updateSelectionCount();

        } catch (err) {
            console.error(err);
            logStatus(`列表加载失败: ${err}`);
            container.innerHTML = `<div style="text-align:center; padding:20px; color:red;">加载失败: ${err}</div>`;
        }
    }

    function updateSelectionCount() {
        const checked = document.querySelectorAll('.bsd-video-item input:checked');
        const count = checked.length;
        document.getElementById('bsd-count').innerText = `已选: ${count}`;
        document.getElementById('bsd-download-btn').disabled = count === 0;
        
        // 更新视觉状态 (选中背景色)
        const allItems = document.querySelectorAll('.bsd-video-item');
        allItems.forEach(item => {
            const cb = item.querySelector('input[type="checkbox"]');
            if (cb && cb.checked) {
                item.classList.add('bsd-selected');
            } else {
                item.classList.remove('bsd-selected');
            }
        });
    }

    // ==========================================
    // 6. 直接下载辅助函数 (GM_download Direct)
    // ==========================================
    function downloadDirectly(content, filename) {
        return new Promise((resolve, reject) => {
            // 使用 Blob URL 触发 GM_download
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            
            GM_download({
                url: url,
                name: filename,
                saveAs: false, // 尝试静默下载，取决于浏览器设置
                onload: () => {
                    setTimeout(() => URL.revokeObjectURL(url), 5000);
                    resolve();
                },
                onerror: (e) => {
                    console.error('Download failed:', e);
                    // 失败尝试回退到 saveAs
                    try {
                        saveAs(blob, filename);
                        resolve();
                    } catch (err) {
                        reject(e);
                    }
                }
            });
        });
    }

    async function startBatchDownload() {
        const checked = document.querySelectorAll('.bsd-video-item input[type="checkbox"]:checked');
        if (checked.length === 0) return;

        const format = document.getElementById('bsd-format').value;
        const btn = document.getElementById('bsd-download-btn');
        const progressBar = document.getElementById('bsd-progress-bar');
        const progressWrap = document.getElementById('bsd-progress-wrap');
        
        btn.disabled = true;
        progressWrap.style.display = 'block';
        progressBar.style.width = '0%';
        
        logStatus('初始化批量下载任务...');
        
        let successCount = 0;
        let failCount = 0;
        let processedCount = 0;
        const failedItems = [];
        
        const updateProgress = () => {
            processedCount++;
            const percent = Math.round((processedCount / checked.length) * 100);
            progressBar.style.width = `${percent}%`;
        };

        const CONCURRENT_LIMIT = 3;
        const queue = Array.from(checked);
        const activePromises = [];
        const startTime = Date.now();
        
        const processItem = async (el, index) => {
            const title = el.dataset.title;
            const cid = el.dataset.cid;
            const bvid = el.dataset.bvid;
            const vidIndex = el.dataset.index;
            const row = el.parentElement;
            const statusCol = row.querySelector('.bsd-video-status-col');
            
            logStatus(`[${index+1}/${checked.length}] 处理中: ${title.slice(0, 15)}...`);
            if (statusCol) statusCol.innerText = '...';
            
            try {
                const subUrl = await fetchSubtitleInfo(bvid, cid);
                if (!subUrl) throw new Error('无 AI/中文字幕');
                
                const jsonBody = await downloadSubtitleJson(subUrl);
                
                if (!jsonBody || !jsonBody.body || !Array.isArray(jsonBody.body) || jsonBody.body.length === 0) {
                    throw new Error('字幕内容为空');
                }

                let content = '';
                if (format === 'srt') content = jsonToSrt(jsonBody);
                else if (format === 'txt' || format === 'md') content = jsonToTxt(jsonBody);
                else if (format === 'lrc') content = jsonToLrc(jsonBody);
                
                let filename = title.replace(/[\\/:*?"<>|]/g, '_').trim();
                if (filename.length > 80) filename = filename.substring(0, 80);

                const date = new Date();
                const mmdd = (date.getMonth() + 1).toString().padStart(2, '0') + date.getDate().toString().padStart(2, '0');
                const hhmm = date.getHours().toString().padStart(2, '0') + date.getMinutes().toString().padStart(2, '0');
                // v1.10: [序号]标题_MMDDHHmm
                const finalName = `[${vidIndex}]${filename}_${mmdd}${hhmm}.${format}`;

                // 直接下载模式
                await downloadDirectly(content, finalName);
                logStatus(`√ 已下载: ${finalName}`);
                // 直接下载模式下，稍微增加一点间隔，避免浏览器弹窗过多被拦截
                await new Promise(r => setTimeout(r, 200));
                
                successCount++;
                if (statusCol) statusCol.innerText = '✅';
                
            } catch (err) {
                console.error(`[BiliSub] ${title} 失败:`, err);
                const errMsg = err.message || '未知错误';
                logStatus(`× 跳过: ${errMsg.slice(0, 20)}...`);
                failCount++;
                failedItems.push({index: vidIndex, title: title, reason: errMsg});
                if (statusCol) {
                    statusCol.innerText = '❎';
                    statusCol.title = errMsg;
                }
                const titleEl = row.querySelector('.bsd-video-title');
                if (titleEl) titleEl.classList.add('failed');
            } finally {
                updateProgress();
            }
        };

        async function runQueue() {
            for (let i = 0; i < queue.length; i++) {
                const p = processItem(queue[i], i);
                activePromises.push(p);
                
                p.finally(() => {
                    activePromises.splice(activePromises.indexOf(p), 1);
                });

                if (activePromises.length >= CONCURRENT_LIMIT) {
                    await Promise.race(activePromises);
                }
                
                // 恢复延迟，防止网络拥塞
                await new Promise(r => setTimeout(r, 800)); 
            }
            await Promise.all(activePromises);
        }

        await runQueue();

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        if (successCount > 0) {
            logStatus(`★ 批量下载完成! 耗时:${duration}s 成功:${successCount} 失败:${failCount}`);
        } else {
            logStatus(`任务结束，未下载到任何有效字幕 (耗时:${duration}s)。`);
        }

        if (failedItems.length > 0) {
            logStatus('--- 失败详情 ---', true);
            failedItems.forEach(item => {
                logStatus(`[序号${item.index}] ${item.reason}`, true);
            });
            const failedIndices = failedItems.map(i => i.index).join(', ');
            logStatus(`失败视频序号: ${failedIndices}`, true);
        }
        
        btn.disabled = false;
        btn.innerText = '开始下载';
        setTimeout(() => { progressWrap.style.display = 'none'; }, 5000);
    }

    // ==========================================
    // 5. 辅助功能 (Helpers)
    // ==========================================
    
    function logStatus(text, append = false) {
        const el = document.getElementById('bsd-status-text');
        if (append) {
            el.innerText += '\n' + text;
        } else {
            el.innerText = text;
        }
        el.scrollTop = el.scrollHeight;
        console.log('[BiliSub]', text);
    }

    setTimeout(initUI, 1500);

})();
