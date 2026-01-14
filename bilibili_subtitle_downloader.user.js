// ==UserScript==
// @name         Bilibili AI Subtitle Batch Downloader
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  批量下载B站视频合集/列表的AI中文字幕，支持MD/TXT/LRC/SRT格式，集成并发控制与重试机制。
// @author       Oak
// @match        https://www.bilibili.com/video/*
// @icon         https://www.bilibili.com/favicon.ico
// @require      https://cdn.bootcdn.net/ajax/libs/spark-md5/3.0.2/spark-md5.min.js
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        GM_addStyle
// @grant        unsafeWindow
// @connect      bilibili.com
// @connect      hdslb.com
// @license      MIT
// ==/UserScript==

// 创建原委：解决B站合集视频AI字幕无法批量下载、只能逐个点击的痛点。
// 用途：自动化提取视频列表，批量请求WBI签名的字幕接口，转换格式并打包为ZIP下载。
// 风险说明：高并发请求可能导致IP临时被B站风控（WBI接口报错403/412），建议保持合理的请求间隔（>800ms）。

(function() {
    'use strict';
    const VERSION = '1.0';
    
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
            background: #00AEEC;
            color: #fff;
            padding: 10px;
            border-radius: 5px 0 0 5px;
            cursor: pointer;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            font-size: 14px;
            transition: right 0.3s;
        }
        #bili-sub-downloader-btn:hover {
            right: -5px;
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
        }
        #bili-sub-downloader-panel.open {
            right: 0;
        }
        .bsd-header {
            padding: 12px 15px;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f8f8f8;
            flex-shrink: 0;
        }
        .bsd-header h3 {
            margin: 0;
            font-size: 15px;
            color: #333;
        }
        .bsd-close {
            cursor: pointer;
            color: #999;
            font-size: 20px;
        }
        .bsd-content {
            flex: 1;
            overflow-y: auto;
            padding: 0;
            min-height: 200px; /* 强制最小高度，防止被压缩 */
        }
        .bsd-content::-webkit-scrollbar {
            width: 6px;
        }
        .bsd-content::-webkit-scrollbar-thumb {
            background-color: #ccc;
            border-radius: 3px;
        }
        /* 筛选栏样式 */
        .bsd-filter-bar {
            padding: 6px 10px;
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
            padding: 4px 6px;
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
            padding: 4px 8px;
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
        /* 紧凑控制行 */
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
        /* 按钮行 */
        .bsd-btn-row {
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
        }
        .bsd-btn {
            background: #00AEEC;
            color: white;
            border: none;
            padding: 6px 0;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            text-align: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            flex: 1; /* 等宽排列 */
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
        /* 紧凑型列表项 */
        .bsd-video-item {
            display: flex;
            align-items: center;
            padding: 2px 6px; /* 极简间距 */
            border-bottom: 1px solid #f9f9f9;
            gap: 6px;
            min-height: 24px; /* 极简高度 */
            transition: background 0.2s;
        }
        .bsd-video-item:hover {
            background: #f0faff;
        }
        .bsd-video-item input[type="checkbox"] {
            margin: 0;
            width: 13px;
            height: 13px;
            cursor: pointer;
        }
        .bsd-video-title {
            font-size: 12px;
            color: #333;
            line-height: 1.2;
            word-break: break-all;
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap; /* 单行显示 */
        }
        .bsd-status {
            font-size: 12px;
            color: #666;
            margin-top: 5px;
            text-align: left;
            background: #eee;
            padding: 6px;
            border-radius: 4px;
            height: 60px; /* 减小日志高度 */
            overflow-y: auto;
            white-space: pre-wrap;
            border: 1px solid #ddd;
        }
        .bsd-progress-container {
            width: 100%;
            height: 3px;
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
            background-color: #fffde7;
        }
        /* 自定义 Tooltip 样式 */
        .bsd-tooltip-container {
            position: relative;
            display: inline-block;
            cursor: help;
        }
        .bsd-tooltip-text {
            visibility: hidden;
            width: 300px;
            background-color: #333;
            color: #fff;
            text-align: left;
            border-radius: 6px;
            padding: 8px 10px;
            position: absolute;
            z-index: 10003;
            bottom: 125%; /* 显示在上方 */
            right: 0;
            opacity: 0;
            transition: opacity 0.2s; /* 快速显示，仅0.2s淡入 */
            font-size: 12px;
            line-height: 1.4;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            white-space: pre-wrap; /* 保留换行 */
        }
        .bsd-tooltip-container:hover .bsd-tooltip-text {
            visibility: visible;
            opacity: 1;
        }
        /* 小三角箭头 */
        .bsd-tooltip-text::after {
            content: "";
            position: absolute;
            top: 100%;
            right: 15px;
            margin-left: -5px;
            border-width: 5px;
            border-style: solid;
            border-color: #333 transparent transparent transparent;
        }
    `;

    // ==========================================
    // 2. 基础 UI 注入 (UI Injection)
    // ==========================================
    function initUI() {
        GM_addStyle(STYLES);

        const toggleBtn = document.createElement('div');
        toggleBtn.id = 'bili-sub-downloader-btn';
        toggleBtn.innerText = 'AI字幕下载';
        document.body.appendChild(toggleBtn);

        const panel = document.createElement('div');
        panel.id = 'bili-sub-downloader-panel';
        panel.innerHTML = `
            <div class="bsd-header">
                <h3>批量字幕下载 v${VERSION}</h3>
                <span class="bsd-close">×</span>
            </div>
            
            <!-- 筛选栏 -->
            <div class="bsd-filter-bar">
                <div class="bsd-filter-row">
                    <input type="text" class="bsd-filter-input" id="bsd-filter-input" placeholder="输入关键词筛选 (空格分隔)">
                    <button class="bsd-filter-btn" id="bsd-filter-select-btn" title="全选当前显示的所有匹配项">全选匹配</button>
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
                
                <!-- 新增：提示信息 -->
                <div class="bsd-ctrl-row" style="justify-content:flex-end; margin-bottom:5px;">
                    <div class="bsd-tooltip-container">
                        <span style="color:#e67e22; font-size:12px; text-align:right;">
                            ⚠️ 提示 (悬浮查看)
                        </span>
                        <span class="bsd-tooltip-text">请关闭浏览器的“下载前询问每个文件的保存位置” 即可实现批量自动下载

v1.0更新：
正式版发布！完善文档与自动化发布流程。</span>
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
        
        filterInput.addEventListener('input', filterVideos);
        selectMatchBtn.addEventListener('click', selectMatchingVideos);
        
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
            // 检查所有关键词是否都在标题中
            const isMatch = keywords.length > 0 && keywords.every(k => title.includes(k));
            
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

    function downloadSubtitleJson(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                timeout: 5000, // 添加超时
                onload: function(response) {
                    try {
                        const json = JSON.parse(response.responseText);
                        resolve(json);
                    } catch (e) {
                        reject(`JSON解析失败`);
                    }
                },
                ontimeout: function() {
                    reject('JSON下载超时');
                },
                onerror: function(err) {
                    reject(`下载失败`);
                }
            });
        });
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
                    <input type="checkbox" data-cid="${v.cid}" data-bvid="${v.bvid}" data-title="${safeTitle}">
                    <div class="bsd-video-title">${index + 1}. ${v.title}</div>
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
        const checked = document.querySelectorAll('.bsd-video-item input[type="checkbox"]:checked');
        document.getElementById('bsd-count').innerText = `已选: ${checked.length}`;
        document.getElementById('bsd-download-btn').disabled = checked.length === 0;
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
            
            logStatus(`[${index+1}/${checked.length}] 处理中: ${title.slice(0, 15)}...`);
            
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
                const finalName = `[${mmdd}${hhmm}]${filename}.${format}`;

                // 直接下载模式
                await downloadDirectly(content, finalName);
                logStatus(`√ 已下载: ${finalName}`);
                // 直接下载模式下，稍微增加一点间隔，避免浏览器弹窗过多被拦截
                await new Promise(r => setTimeout(r, 200));
                
                successCount++;
                
            } catch (err) {
                console.error(`[BiliSub] ${title} 失败:`, err);
                const errMsg = err.message || '未知错误';
                logStatus(`× 跳过: ${errMsg.slice(0, 20)}...`);
                failCount++;
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
            if (useZip) {
                // ZIP 模式最后的打包环节
                logStatus(`正在打包 ${successCount} 个文件...`);
                try {
                    // 阶段 1: 生成 ZIP Blob (带超时保护)
                    const zipPromise = zip.generateAsync({
                        type: "blob",
                        compression: "STORE" 
                    }, (metadata) => {
                        logStatus(`ZIP生成中: ${metadata.percent.toFixed(1)}%`);
                    });
                    
                    // 超时竞赛
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('ZIP 生成超时 (>30s)')), 30000)
                    );
                    
                    const content = await Promise.race([zipPromise, timeoutPromise]);
                    
                    logStatus(`ZIP 数据构建完成 (${(content.size / 1024).toFixed(1)} KB)`);
                    
                    // 大小检查
                    if (content.size > 52428800) {
                        logStatus('⚠️ 警告：ZIP 文件较大 (>50MB)，如下载失败请尝试分批下载');
                    }
                    
                    const zipName = `B站字幕打包_${new Date().toISOString().slice(0,10)}_${new Date().getTime()}.zip`;
                    logStatus(`正在唤起下载器...`);
                    
                    // 阶段 2: 优先使用 GM_download
                    const url = URL.createObjectURL(content);
                    try {
                        // 阶段 3: 触发 GM_download
                        await new Promise((resolve, reject) => {
                            GM_download({
                                url: url,
                                name: zipName,
                                saveAs: true,
                                onload: () => {
                                    URL.revokeObjectURL(url);
                                    resolve();
                                },
                                onerror: (e) => reject(e)
                            });
                        });
                        logStatus('★ 下载已开始 (GM_download)');
                    } catch (gmErr) {
                        console.warn('GM_download failed:', gmErr);
                        logStatus('GM_download 失败，降级到浏览器下载...');
                        
                        // 降级：saveAs
                        try {
                             saveAs(content, zipName);
                             logStatus(`★ 已调用 saveAs，请留意下载弹窗`);
                        } catch (saveErr) {
                             logStatus(`❌ 下载彻底失败: ${saveErr.message}`);
                             // 提供手动链接
                             logStatus(`提示: 请尝试取消"打包为ZIP"选项重试`);
                        }
                    }
                } catch (e) {
                    console.error(e);
                    logStatus(`❌ 打包失败: ${e.message}`);
                }
            } else {
                // 直接下载模式完成
                logStatus(`★ 批量下载完成! 耗时:${duration}s 成功:${successCount} 失败:${failCount}`);
            }
        } else {
            logStatus(`任务结束，未下载到任何有效字幕 (耗时:${duration}s)。`);
        }

        btn.disabled = false;
        setTimeout(() => { progressWrap.style.display = 'none'; }, 5000);
    }

    // ==========================================
    // 5. 辅助功能 (Helpers)
    // ==========================================
    
    function logStatus(text) {
        const el = document.getElementById('bsd-status-text');
        el.innerText = text;
        el.scrollTop = el.scrollHeight;
        console.log('[BiliSub]', text);
    }

    setTimeout(initUI, 1500);

})();
