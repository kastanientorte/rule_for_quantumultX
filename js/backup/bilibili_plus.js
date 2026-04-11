const scriptName = "BiliBili";
const storyAidKey = "bilibili_story_aid";
const blackKey = "bilibili_feed_black";

let blacklist = [];
{
    let raw = $persistentStore.read(blackKey);
    if (raw) {
        blacklist = raw.split(";");
    } else {
        $persistentStore.write("", blackKey);
    }
}

( () => {
    let body = null;

    if (typeof $response === "undefined") {
        console.log(`[${scriptName}] 非响应阶段，跳过`);
        return $done();
    }

    const url = $request.url;
    const rawBody = $response.body;

    if (!rawBody) {
        console.log(`[${scriptName}] 响应体为空，跳过`);
        return $done();
    }

    switch (true) {
        // 推荐去广告
        case /^https:\/\/app\.bilibili\.com\/x\/v2\/feed\/index\?/.test(url): {
            try {
                let obj = JSON.parse(rawBody);
                if (!obj?.data?.items) break;
                let items = [];
                for (let item of obj.data.items) {
                    if (item.hasOwnProperty("banner_item")) {
                        let bannerItems = item.banner_item.filter(
                            (b) => b.type !== "ad" && !( b.static_banner && b.static_banner.is_ad_loc === true )
                        );
                        if (bannerItems.length >= 1) {
                            item.banner_item = bannerItems;
                            items.push(item);
                        }
                    } else if (
                        !item.hasOwnProperty("ad_info") &&
                        item?.args?.up_name &&
                        !blacklist.includes(item.args.up_name) &&
                        item.card_goto.indexOf("ad") === -1 &&
                        ( item.card_type === "small_cover_v2" || item.card_type === "large_cover_v1" )
                    ) {
                        items.push(item);
                    }
                }
                obj.data.items = items;
                body = JSON.stringify(obj);
            } catch (err) {
                console.log(`[${scriptName}] 推荐去广告异常：${err}`);
            }
            break;
        }

        // Story模式记录aid
        case /^https:\/\/app\.bilibili\.com\/x\/v2\/feed\/index\/story\?/.test(url): {
            try {
                let obj = JSON.parse(rawBody);
                if (obj?.data?.items?.length > 0) {
                    let lastItem = obj.data.items[obj.data.items.length - 1];
                    let aid = lastItem?.stat?.aid?.toString();
                    if (aid) $persistentStore.write(aid, storyAidKey);
                }
            } catch (err) {
                console.log(`[${scriptName}] 记录Story aid异常：${err}`);
            }
            break;
        }

        // 开屏广告
        case /^https?:\/\/app\.bilibili\.com\/x\/v2\/splash\/list/.test(url): {
            try {
                let obj = JSON.parse(rawBody);
                if (obj?.data) {
                    obj.data.max_time = 0;
                    obj.data.min_interval = 31536000;
                    obj.data.pull_interval = 31536000;
                    if (obj.data.list) {
                        for (let item of obj.data.list) {
                            item.duration = 0;
                            item.begin_time = 1915027200;
                            item.end_time = 1924272000;
                        }
                    }
                }
                body = JSON.stringify(obj);
            } catch (err) {
                console.log(`[${scriptName}] 开屏广告异常：${err}`);
            }
            break;
        }

        // 标签页
        case /^https?:\/\/app\.bilibili\.com\/x\/resource\/show\/tab/.test(url): {
            try {
                const tabNameList = new Set(["直播", "推荐", "热门", "追番", "影视", "校园"]);
                const topList = new Set([176, 222, 107]);
                const bottomList = new Set([177, 178, 179, 181, 102, 103, 104, 105, 106]);
                let obj = JSON.parse(rawBody);
                if (obj?.data?.tab) {
                    obj.data.tab = obj.data.tab.filter((e) => tabNameList.has(e.name));
                }
                let storyAid = $persistentStore.read(storyAidKey) || "246834163";
                if (obj?.data?.top) {
                    let top = obj.data.top.filter((e) => {
                        if (e.id === 222 || e.id === 107) {
                            e.uri = `bilibili://story/${storyAid}`;
                            e.icon = "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/script/bilibili/bilibili_icon.png";
                            e.tab_id = "Story_Top";
                            e.name = "Story";
                        }
                        return topList.has(e.id);
                    });
                    top.push({
                        id: 3510,
                        icon: "http://i0.hdslb.com/bfs/archive/d43047538e72c9ed8fd8e4e34415fbe3a4f632cb.png",
                        name: "消息",
                        uri: "bilibili://link/im_home",
                        tab_id: "消息Top",
                        pos: 2,
                    });
                    obj.data.top = top;
                }
                if (obj?.data?.bottom) {
                    obj.data.bottom = obj.data.bottom.filter((e) => bottomList.has(e.id));
                }
                body = JSON.stringify(obj);
            } catch (err) {
                console.log(`[${scriptName}] 标签页异常：${err}`);
            }
            break;
        }

        // 我的页面
        case /^https?:\/\/app\.bilibili\.com\/x\/v2\/account\/mine/.test(url): {
            try {
                let obj = JSON.parse(rawBody);
                const itemList = new Set([3072, 2830, 396, 397, 398, 399, 171, 172, 534, 8, 4, 428, 352, 1, 405, 402, 404, 544, 407, 410, 622, 425, 426, 427, 428, 171, 430, 431, 432]);
                if (obj?.data?.sections_v2) {
                    obj.data.sections_v2.forEach((element, index) => {
                        element.items?.forEach((e) => {
                            if (e.id === 622) {
                                e.title = "会员购";
                                e.uri = "bilibili://mall/home";
                            }
                        });
                        let items = ( element.items || [] ).filter((e) => itemList.has(e.id));
                        obj.data.sections_v2[index].button = {};
                        delete obj.data.sections_v2[index].be_up_title;
                        delete obj.data.sections_v2[index].tip_icon;
                        delete obj.data.sections_v2[index].tip_title;
                        obj.data.sections_v2[index].items = items;
                    });
                }
                body = JSON.stringify(obj);
            } catch (err) {
                console.log(`[${scriptName}] 我的页面异常：${err}`);
            }
            break;
        }

        // 直播去广告
        case /^https?:\/\/api\.live\.bilibili\.com\/xlive\/app-room\/v1\/index\/getInfoByRoom/.test(url): {
            try {
                let obj = JSON.parse(rawBody);
                if (obj?.data) obj.data.activity_banner_info = null;
                body = JSON.stringify(obj);
            } catch (err) {
                console.log(`[${scriptName}] 直播去广告异常：${err}`);
            }
            break;
        }

        // 追番去广告
        case /^https?:\/\/api\.bilibili\.com\/pgc\/page\/bangumi/.test(url): {
            try {
                let obj = JSON.parse(rawBody);
                if (obj?.result?.modules) {
                    obj.result.modules.forEach((module) => {
                        if (module.style?.startsWith("banner")) {
                            module.items = module.items.filter((i) => !( i.source_content && i.source_content.ad_content ));
                        }
                    });
                }
                body = JSON.stringify(obj);
            } catch (err) {
                console.log(`[${scriptName}] 追番去广告异常：${err}`);
            }
            break;
        }

        // 动态去广告
        case /^https?:\/\/api\.vc\.bilibili\.com\/dynamic_svr\/v1\/dynamic_svr\/dynamic_(history|new)\?/.test(url): {
            try {
                let obj = JSON.parse(rawBody);
                if (obj?.data?.cards) {
                    let cards = [];
                    obj.data.cards.forEach((element) => {
                        if (element.hasOwnProperty("display") && element.card.indexOf("ad_ctx") <= 0) {
                            element.desc.dynamic_id = element.desc.dynamic_id_str;
                            element.desc.pre_dy_id = element.desc.pre_dy_id_str;
                            element.desc.orig_dy_id = element.desc.orig_dy_id_str;
                            element.desc.rid = element.desc.rid_str;
                            cards.push(element);
                        }
                    });
                    obj.data.cards = cards;
                }
                body = JSON.stringify(obj);
            } catch (err) {
                console.log(`[${scriptName}] 动态去广告异常：${err}`);
            }
            break;
        }

        // 去除皮肤
        case /^https?:\/\/app\.bilibili\.com\/x\/resource\/show\/skin\?/.test(url): {
            try {
                let obj = JSON.parse(rawBody);
                if (obj?.data) obj.data.common_equip = {};
                body = JSON.stringify(obj);
            } catch (err) {
                console.log(`[${scriptName}] 去除皮肤异常：${err}`);
            }
            break;
        }

        // Story模式广告流
        case /^https:\/\/app\.bilibili\.com\/x\/v2\/feed\/index\/story(\/cart|\?|$)/.test(url): {
            try {
                let obj = JSON.parse(rawBody);
                if (obj?.data) obj.data.ads = null;
                body = JSON.stringify(obj);
            } catch (err) {
                console.log(`[${scriptName}] 广告流异常：${err}`);
            }
            break;
        }

        // 屏蔽短视频相关
        case /^https?:\/\/app\.bilibili\.com\/x\/v2\/feed\/index\/relate\/story\?/.test(url): {
            try {
                let obj = JSON.parse(rawBody);
                obj.data = null;
                body = JSON.stringify(obj);
            } catch (err) {
                console.log(`[${scriptName}] Story模式异常：${err}`);
            }
            break;
        }

        default:
            break;
    }

    if (body) {
        $done({ body, headers: $response.headers, status: $response.status });
    } else {
        $done();
    }
} )();