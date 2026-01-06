// Simple i18n system for English and Arabic
import { useState } from "react";

const translations = {
    en: {
        // Platform Connections Page
        "platformConnections": "Platform Connections",
        "connectPlatformsSubtitle": "Connect platforms for server-side tracking",
        "store": "Store",
        "activeStore": "Active Store",
        "pickStore": "Pick which Salla store you want to configure",
        "selectStore": "Select a store",
        "loadingStores": "Loading stores...",

        // Platform Cards
        "googleAnalytics4": "Google Analytics 4",
        "ga4Desc": "Server-side purchase and conversion events to GA4",
        "meta": "Meta",
        "metaDesc": "Server-side events to Meta Pixel (CAPI)",
        "tiktok": "TikTok",
        "tiktokDesc": "Server-side events to TikTok Pixel (Events API)",
        "snap": "Snap",
        "snapDesc": "Server-side events to Snap Pixel (Conversions API)",

        // Form Fields
        "measurementId": "Measurement ID",
        "apiSecret": "API Secret",
        "pixelId": "Pixel ID",
        "accessToken": "Access Token",
        "token": "Token",
        "enterApiSecret": "Enter API Secret",
        "enterAccessToken": "Access Token",

        // Buttons
        "connectGA4": "Connect GA4",
        "connectMeta": "Connect Meta",
        "connectTikTok": "Connect TikTok",
        "connectSnap": "Connect Snap",
        "validating": "Validating...",

        // Status
        "connected": "Connected",
        "disconnected": "Disconnected",
        "ga4Connected": "GA4 is successfully connected.",
        "metaConnected": "Meta is successfully connected.",
        "tiktokConnected": "TikTok is successfully connected.",
        "snapConnected": "Snap is successfully connected.",

        // Errors
        "storeIdNotSet": "Store ID not set yet.",
        "enterMeasurementIdAndSecret": "Please enter Measurement ID and API Secret",
        "enterPixelIdAndToken": "Please enter Pixel ID and Access Token",
        "failedToConnectGA4": "Failed to connect GA4",
        "failedToConnectMeta": "Failed to connect Meta",
        "failedToConnectTikTok": "Failed to connect TikTok",
        "failedToConnectSnap": "Failed to connect Snap",

        // Language
        "language": "Language",
        "english": "English",
        "arabic": "العربية",

        // Dashboard
        "dashTitle": "Salla Hub",
        "dashSubtitle": "Server-side tracking overview",
        "dashStore": "Store",
        "dashLast24h": "Last 24 hours",
        "kpiTotalEvents": "Total Events",
        "kpiSent": "Sent",
        "kpiFailed": "Failed",
        "kpiSkipped": "Skipped",
        "kpiRevenue": "Revenue",
        "kpiVsPrev24h": "vs previous 24h",
        "trafficTrendTitle": "Traffic Trend",
        "trafficPill": "Traffic",
        "trafficWeeklySubtitle": "Weekly totals by platform • compare current vs previous week",
        "trafficCurWeek": "Current week",
        "trafficPrevWeek": "Previous week",
        "trafficCurWeekDaily": "Current week (last 7 days, events/day)",
        "trafficPrevWeekDaily": "Previous week (7–14 days ago, events/day)",
        "trafficDaily": "Daily",
        "trafficWeekly": "Weekly",
        "trafficThisWeek": "This week",
        "trafficPreviousWeek": "Previous week",
        "trafficEmpty": "No traffic yet for the last 7 days.",
        "platformDistTitle": "Platform Distribution",
        "platformDistSubtitle": "Last 24 hours",
        "platformDistPill": "Sources",
        "platformCardForwarded": "Forwarded",
        "platformCardSuccess": "Success",
        "platformCardRevenue": "Revenue",
        "platformCardLoss": "Loss",

        // Logs
        "logsTitle": "Event Logs",
        "logsLoadingSubtitle": "Loading event history…",
        "logsEmptySubtitle": "No events received yet",
        "logsEmptyTitle": "No events yet",
        "logsEmptyBody": "Events will appear here once your store starts receiving orders and tracking is enabled.",
        "logsMainSubtitle": "Detailed delivery history of conversion events",
        "logsSearchPlaceholder": "Search order id, platform, type, status...",
        "logsAllPlatforms": "All Platforms",
        "logsAllStatus": "All Status",
        "logsTime": "Time",
        "logsPlatform": "Platform",
        "logsType": "Type",
        "logsOrderId": "Order ID",
        "logsValue": "Value",
        "logsStatus": "Status",
        "logsPayload": "Payload",
        "logsNoResults": "No results match your filters.",
        "logsShowing": "Showing",
        "logsOf": "of",
        "logsEvents": "events"
    },
    ar: {
        // Platform Connections Page
        "platformConnections": "اتصالات المنصات",
        "connectPlatformsSubtitle": "اتصل بالمنصات لتتبع من جانب الخادم",
        "store": "المتجر",
        "activeStore": "المتجر النشط",
        "pickStore": "اختر متجر Salla الذي تريد تكوينه",
        "selectStore": "اختر متجرًا",
        "loadingStores": "جاري تحميل المتاجر...",

        // Platform Cards
        "googleAnalytics4": "Google Analytics 4",
        "ga4Desc": "أحداث الشراء والتحويل من جانب الخادم إلى GA4",
        "meta": "Meta",
        "metaDesc": "أحداث من جانب الخادم إلى Meta Pixel (CAPI)",
        "tiktok": "TikTok",
        "tiktokDesc": "أحداث من جانب الخادم إلى TikTok Pixel (Events API)",
        "snap": "Snap",
        "snapDesc": "أحداث من جانب الخادم إلى Snap Pixel (Conversions API)",

        // Form Fields
        "measurementId": "معرف القياس",
        "apiSecret": "مفتاح API السري",
        "pixelId": "معرف البكسل",
        "accessToken": "رمز الوصول",
        "token": "الرمز",
        "enterApiSecret": "أدخل مفتاح API السري",
        "enterAccessToken": "رمز الوصول",

        // Buttons
        "connectGA4": "اتصل بـ GA4",
        "connectMeta": "اتصل بـ Meta",
        "connectTikTok": "اتصل بـ TikTok",
        "connectSnap": "اتصل بـ Snap",
        "validating": "جاري التحقق...",

        // Status
        "connected": "متصل",
        "disconnected": "غير متصل",
        "ga4Connected": "تم الاتصال بـ GA4 بنجاح.",
        "metaConnected": "تم الاتصال بـ Meta بنجاح.",
        "tiktokConnected": "تم الاتصال بـ TikTok بنجاح.",
        "snapConnected": "تم الاتصال بـ Snap بنجاح.",

        // Errors
        "storeIdNotSet": "لم يتم تعيين معرف المتجر بعد.",
        "enterMeasurementIdAndSecret": "يرجى إدخال معرف القياس ومفتاح API السري",
        "enterPixelIdAndToken": "يرجى إدخال معرف البكسل ورمز الوصول",
        "failedToConnectGA4": "فشل الاتصال بـ GA4",
        "failedToConnectMeta": "فشل الاتصال بـ Meta",
        "failedToConnectTikTok": "فشل الاتصال بـ TikTok",
        "failedToConnectSnap": "فشل الاتصال بـ Snap",

        // Language
        "language": "اللغة",
        "english": "English",
        "arabic": "العربية",

        // Dashboard
        "dashTitle": "سلة هَب",
        "dashSubtitle": "نظرة عامة على التتبع من جانب الخادم",
        "dashStore": "المتجر",
        "dashLast24h": "آخر 24 ساعة",
        "kpiTotalEvents": "إجمالي الأحداث",
        "kpiSent": "تم الإرسال",
        "kpiFailed": "فشل",
        "kpiSkipped": "تخطّي",
        "kpiRevenue": "الإيرادات",
        "kpiVsPrev24h": "مقارنة بالـ 24 ساعة السابقة",
        "trafficTrendTitle": "اتجاه الزيارات",
        "trafficPill": "الزيارات",
        "trafficWeeklySubtitle": "إجمالي أسبوعي لكل منصة • مقارنة الأسبوع الحالي بالسابق",
        "trafficCurWeek": "الأسبوع الحالي",
        "trafficPrevWeek": "الأسبوع السابق",
        "trafficCurWeekDaily": "الأسبوع الحالي (آخر 7 أيام، أحداث/يوم)",
        "trafficPrevWeekDaily": "الأسبوع السابق (من 7 إلى 14 يومًا مضت، أحداث/يوم)",
        "trafficDaily": "يومي",
        "trafficWeekly": "أسبوعي",
        "trafficThisWeek": "هذا الأسبوع",
        "trafficPreviousWeek": "الأسبوع السابق",
        "trafficEmpty": "لا توجد زيارات خلال آخر 7 أيام.",
        "platformDistTitle": "توزيع المنصات",
        "platformDistSubtitle": "آخر 24 ساعة",
        "platformDistPill": "المصادر",
        "platformCardForwarded": "مُرسَلة",
        "platformCardSuccess": "النجاح",
        "platformCardRevenue": "الإيرادات",
        "platformCardLoss": "الفاقد",

        // Logs
        "logsTitle": "سجل الأحداث",
        "logsLoadingSubtitle": "جاري تحميل سجل الأحداث…",
        "logsEmptySubtitle": "لم يتم استلام أي أحداث بعد",
        "logsEmptyTitle": "لا توجد أحداث بعد",
        "logsEmptyBody": "ستظهر الأحداث هنا بمجرد أن يبدأ متجرك في تلقي الطلبات ويتم تفعيل التتبع.",
        "logsMainSubtitle": "سجل تفصيلي لإرسال أحداث التحويل",
        "logsSearchPlaceholder": "ابحث برقم الطلب، المنصة، النوع، الحالة...",
        "logsAllPlatforms": "كل المنصات",
        "logsAllStatus": "كل الحالات",
        "logsTime": "الوقت",
        "logsPlatform": "المنصة",
        "logsType": "النوع",
        "logsOrderId": "رقم الطلب",
        "logsValue": "القيمة",
        "logsStatus": "الحالة",
        "logsPayload": "البيانات",
        "logsNoResults": "لا توجد نتائج مطابقة لعوامل التصفية.",
        "logsShowing": "عرض",
        "logsOf": "من",
        "logsEvents": "أحداث"
    }
};

// Get language from localStorage or default to 'en'
function getLanguage() {
    try {
        const lang = localStorage.getItem('app_language');
        return lang && (lang === 'en' || lang === 'ar') ? lang : 'en';
    } catch {
        return 'en';
    }
}

// Set language
function setLanguage(lang) {
    try {
        if (lang === 'en' || lang === 'ar') {
            localStorage.setItem('app_language', lang);
            document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
            document.documentElement.setAttribute('lang', lang);
        }
    } catch {
        // ignore
    }
}

// Initialize language on load
setLanguage(getLanguage());

// Translation hook/function
export function useTranslation() {
    const [lang, setLangState] = useState(getLanguage());

    const t = (key) => {
        return translations[lang]?.[key] || translations.en[key] || key;
    };

    const changeLanguage = (newLang) => {
        if (newLang === 'en' || newLang === 'ar') {
            setLanguage(newLang);
            setLangState(newLang);
        }
    };

    return { t, lang, changeLanguage };
}

// Simple translation function (for non-hook usage)
export function t(key) {
    const lang = getLanguage();
    return translations[lang]?.[key] || translations.en[key] || key;
}

export { getLanguage, setLanguage };
