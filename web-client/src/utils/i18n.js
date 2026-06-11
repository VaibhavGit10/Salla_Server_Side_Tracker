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

        // Disconnect / Test
        "disconnect": "Disconnect",
        "disconnecting": "Disconnecting...",
        "testConnection": "Test",
        "testing": "Testing...",
        "testSuccess": "Test event sent successfully.",
        "testFailed": "Test event failed",
        "validationWarning": "Saved, but token validation failed — events may not send.",
        "reconnect": "Update credentials",

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
        "english": "EN",
        "arabic": "AR",

        // Sidebar
        "sidebarBrandName": "Salla Tracker",
        "sidebarBrandTag": "Server-Side Tracking",
        "sidebarMenu": "Menu",
        "sidebarDashboard": "Dashboard",
        "sidebarConnections": "Connections",
        "sidebarEventLogs": "Event Logs",
        "sidebarHealthy": "System Healthy",
        "sidebarUnhealthy": "System Unreachable",
        "sidebarChecking": "Checking...",
        "sidebarLive": "LIVE",
        "sidebarDown": "DOWN",

        // Dashboard
        "dashTitle": "Salla Tracker",
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
        "trafficWeeklySubtitle": "Weekly totals by platform \u2022 compare current vs previous week",
        "trafficCurWeek": "Current week",
        "trafficPrevWeek": "Previous week",
        "trafficCurWeekDaily": "Current week (last 7 days, events/day)",
        "trafficPrevWeekDaily": "Previous week (7\u201314 days ago, events/day)",
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
        "platformCardLoss": "Skipped %",
        "platformCardNoEvents": "No events yet",
        "platformCardNoEventsDesc": "Events will appear once tracking is enabled for this platform.",

        // Platform help text
        "helpGA4MeasurementId": "Found in GA4 Admin \u2192 Data Streams \u2192 Web stream details",
        "helpGA4ApiSecret": "GA4 Admin \u2192 Data Streams \u2192 Measurement Protocol API secrets",
        "helpMetaPixelId": "Found in Meta Events Manager \u2192 Data Sources \u2192 Pixel ID",
        "helpMetaAccessToken": "Meta Events Manager \u2192 Settings \u2192 Generate access token",
        "helpTikTokPixelId": "Found in TikTok Events Manager \u2192 Web Events \u2192 Pixel ID",
        "helpTikTokAccessToken": "TikTok Events Manager \u2192 Settings \u2192 Generate access token",
        "helpSnapPixelId": "Found in Snap Ads Manager \u2192 Events Manager \u2192 Pixel ID",
        "helpSnapToken": "Snap Ads Manager \u2192 Events Manager \u2192 Conversions API token",

        // Retry
        "retry": "Retry",
        "retrying": "Retrying...",
        "retrySuccess": "Event retried successfully.",
        "retryFailed": "Retry failed",

        // Logs
        "logsTitle": "Event Logs",
        "logsLoadingSubtitle": "Loading event history\u2026",
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
        "logsEvents": "events",
        "logsRefresh": "Refresh",
        "logsRefreshing": "Refreshing...",
        "logsViewPayload": "View Payload",
        "logsLastAttemptInfo": "Last Attempt Info",

        // Status summary
        "statusSuccess": "Success",
        "statusFailed": "Failed",
        "statusSkipped": "Skipped",
        "statusPending": "Pending",

        // Show / Hide
        "show": "Show",
        "hide": "Hide"
    },
    ar: {
        // Platform Connections Page
        "platformConnections": "\u0627\u062a\u0635\u0627\u0644\u0627\u062a \u0627\u0644\u0645\u0646\u0635\u0627\u062a",
        "connectPlatformsSubtitle": "\u0627\u062a\u0635\u0644 \u0628\u0627\u0644\u0645\u0646\u0635\u0627\u062a \u0644\u062a\u062a\u0628\u0639 \u0645\u0646 \u062c\u0627\u0646\u0628 \u0627\u0644\u062e\u0627\u062f\u0645",
        "store": "\u0627\u0644\u0645\u062a\u062c\u0631",
        "activeStore": "\u0627\u0644\u0645\u062a\u062c\u0631 \u0627\u0644\u0646\u0634\u0637",
        "pickStore": "\u0627\u062e\u062a\u0631 \u0645\u062a\u062c\u0631 Salla \u0627\u0644\u0630\u064a \u062a\u0631\u064a\u062f \u062a\u0643\u0648\u064a\u0646\u0647",
        "selectStore": "\u0627\u062e\u062a\u0631 \u0645\u062a\u062c\u0631\u064b\u0627",
        "loadingStores": "\u062c\u0627\u0631\u064a \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0645\u062a\u0627\u062c\u0631...",

        // Platform Cards
        "googleAnalytics4": "Google Analytics 4",
        "ga4Desc": "\u0623\u062d\u062f\u0627\u062b \u0627\u0644\u0634\u0631\u0627\u0621 \u0648\u0627\u0644\u062a\u062d\u0648\u064a\u0644 \u0645\u0646 \u062c\u0627\u0646\u0628 \u0627\u0644\u062e\u0627\u062f\u0645 \u0625\u0644\u0649 GA4",
        "meta": "Meta",
        "metaDesc": "\u0623\u062d\u062f\u0627\u062b \u0645\u0646 \u062c\u0627\u0646\u0628 \u0627\u0644\u062e\u0627\u062f\u0645 \u0625\u0644\u0649 Meta Pixel (CAPI)",
        "tiktok": "TikTok",
        "tiktokDesc": "\u0623\u062d\u062f\u0627\u062b \u0645\u0646 \u062c\u0627\u0646\u0628 \u0627\u0644\u062e\u0627\u062f\u0645 \u0625\u0644\u0649 TikTok Pixel (Events API)",
        "snap": "Snap",
        "snapDesc": "\u0623\u062d\u062f\u0627\u062b \u0645\u0646 \u062c\u0627\u0646\u0628 \u0627\u0644\u062e\u0627\u062f\u0645 \u0625\u0644\u0649 Snap Pixel (Conversions API)",

        // Form Fields
        "measurementId": "\u0645\u0639\u0631\u0641 \u0627\u0644\u0642\u064a\u0627\u0633",
        "apiSecret": "\u0645\u0641\u062a\u0627\u062d API \u0627\u0644\u0633\u0631\u064a",
        "pixelId": "\u0645\u0639\u0631\u0641 \u0627\u0644\u0628\u0643\u0633\u0644",
        "accessToken": "\u0631\u0645\u0632 \u0627\u0644\u0648\u0635\u0648\u0644",
        "token": "\u0627\u0644\u0631\u0645\u0632",
        "enterApiSecret": "\u0623\u062f\u062e\u0644 \u0645\u0641\u062a\u0627\u062d API \u0627\u0644\u0633\u0631\u064a",
        "enterAccessToken": "\u0631\u0645\u0632 \u0627\u0644\u0648\u0635\u0648\u0644",

        // Buttons
        "connectGA4": "\u0627\u062a\u0635\u0644 \u0628\u0640 GA4",
        "connectMeta": "\u0627\u062a\u0635\u0644 \u0628\u0640 Meta",
        "connectTikTok": "\u0627\u062a\u0635\u0644 \u0628\u0640 TikTok",
        "connectSnap": "\u0627\u062a\u0635\u0644 \u0628\u0640 Snap",
        "validating": "\u062c\u0627\u0631\u064a \u0627\u0644\u062a\u062d\u0642\u0642...",

        // Status
        "connected": "\u0645\u062a\u0635\u0644",
        "disconnected": "\u063a\u064a\u0631 \u0645\u062a\u0635\u0644",
        "ga4Connected": "\u062a\u0645 \u0627\u0644\u0627\u062a\u0635\u0627\u0644 \u0628\u0640 GA4 \u0628\u0646\u062c\u0627\u062d.",
        "metaConnected": "\u062a\u0645 \u0627\u0644\u0627\u062a\u0635\u0627\u0644 \u0628\u0640 Meta \u0628\u0646\u062c\u0627\u062d.",
        "tiktokConnected": "\u062a\u0645 \u0627\u0644\u0627\u062a\u0635\u0627\u0644 \u0628\u0640 TikTok \u0628\u0646\u062c\u0627\u062d.",
        "snapConnected": "\u062a\u0645 \u0627\u0644\u0627\u062a\u0635\u0627\u0644 \u0628\u0640 Snap \u0628\u0646\u062c\u0627\u062d.",

        // Disconnect / Test
        "disconnect": "\u0642\u0637\u0639 \u0627\u0644\u0627\u062a\u0635\u0627\u0644",
        "disconnecting": "\u062c\u0627\u0631\u064a \u0642\u0637\u0639 \u0627\u0644\u0627\u062a\u0635\u0627\u0644...",
        "testConnection": "\u0627\u062e\u062a\u0628\u0627\u0631",
        "testing": "\u062c\u0627\u0631\u064a \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631...",
        "testSuccess": "\u062a\u0645 \u0625\u0631\u0633\u0627\u0644 \u062d\u062f\u062b \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631 \u0628\u0646\u062c\u0627\u062d.",
        "testFailed": "\u0641\u0634\u0644 \u0625\u0631\u0633\u0627\u0644 \u062d\u062f\u062b \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631",
        "validationWarning": "\u062a\u0645 \u0627\u0644\u062d\u0641\u0638\u060c \u0644\u0643\u0646 \u0641\u0634\u0644 \u0627\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0631\u0645\u0632 \u2014 \u0642\u062f \u0644\u0627 \u062a\u0631\u0633\u064e\u0644 \u0627\u0644\u0623\u062d\u062f\u0627\u062b.",
        "reconnect": "\u062a\u062d\u062f\u064a\u062b \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0627\u0639\u062a\u0645\u0627\u062f",

        // Errors
        "storeIdNotSet": "\u0644\u0645 \u064a\u062a\u0645 \u062a\u0639\u064a\u064a\u0646 \u0645\u0639\u0631\u0641 \u0627\u0644\u0645\u062a\u062c\u0631 \u0628\u0639\u062f.",
        "enterMeasurementIdAndSecret": "\u064a\u0631\u062c\u0649 \u0625\u062f\u062e\u0627\u0644 \u0645\u0639\u0631\u0641 \u0627\u0644\u0642\u064a\u0627\u0633 \u0648\u0645\u0641\u062a\u0627\u062d API \u0627\u0644\u0633\u0631\u064a",
        "enterPixelIdAndToken": "\u064a\u0631\u062c\u0649 \u0625\u062f\u062e\u0627\u0644 \u0645\u0639\u0631\u0641 \u0627\u0644\u0628\u0643\u0633\u0644 \u0648\u0631\u0645\u0632 \u0627\u0644\u0648\u0635\u0648\u0644",
        "failedToConnectGA4": "\u0641\u0634\u0644 \u0627\u0644\u0627\u062a\u0635\u0627\u0644 \u0628\u0640 GA4",
        "failedToConnectMeta": "\u0641\u0634\u0644 \u0627\u0644\u0627\u062a\u0635\u0627\u0644 \u0628\u0640 Meta",
        "failedToConnectTikTok": "\u0641\u0634\u0644 \u0627\u0644\u0627\u062a\u0635\u0627\u0644 \u0628\u0640 TikTok",
        "failedToConnectSnap": "\u0641\u0634\u0644 \u0627\u0644\u0627\u062a\u0635\u0627\u0644 \u0628\u0640 Snap",

        // Language
        "language": "\u0627\u0644\u0644\u063a\u0629",
        "english": "EN",
        "arabic": "AR",

        // Sidebar
        "sidebarBrandName": "\u0633\u0644\u0629 \u062a\u0631\u0627\u0643\u0631",
        "sidebarBrandTag": "\u0627\u0644\u062a\u062a\u0628\u0639 \u0645\u0646 \u062c\u0627\u0646\u0628 \u0627\u0644\u062e\u0627\u062f\u0645",
        "sidebarMenu": "\u0627\u0644\u0642\u0627\u0626\u0645\u0629",
        "sidebarDashboard": "\u0644\u0648\u062d\u0629 \u0627\u0644\u062a\u062d\u0643\u0645",
        "sidebarConnections": "\u0627\u0644\u0627\u062a\u0635\u0627\u0644\u0627\u062a",
        "sidebarEventLogs": "\u0633\u062c\u0644 \u0627\u0644\u0623\u062d\u062f\u0627\u062b",
        "sidebarHealthy": "\u0627\u0644\u0646\u0638\u0627\u0645 \u064a\u0639\u0645\u0644",
        "sidebarUnhealthy": "\u0627\u0644\u0646\u0638\u0627\u0645 \u063a\u064a\u0631 \u0645\u062a\u0627\u062d",
        "sidebarChecking": "\u062c\u0627\u0631\u064a \u0627\u0644\u0641\u062d\u0635...",
        "sidebarLive": "\u0645\u0628\u0627\u0634\u0631",
        "sidebarDown": "\u0645\u062a\u0648\u0642\u0641",

        // Dashboard
        "dashTitle": "\u0633\u0644\u0629 \u062a\u0631\u0627\u0643\u0631",
        "dashSubtitle": "\u0646\u0638\u0631\u0629 \u0639\u0627\u0645\u0629 \u0639\u0644\u0649 \u0627\u0644\u062a\u062a\u0628\u0639 \u0645\u0646 \u062c\u0627\u0646\u0628 \u0627\u0644\u062e\u0627\u062f\u0645",
        "dashStore": "\u0627\u0644\u0645\u062a\u062c\u0631",
        "dashLast24h": "\u0622\u062e\u0631 24 \u0633\u0627\u0639\u0629",
        "kpiTotalEvents": "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0623\u062d\u062f\u0627\u062b",
        "kpiSent": "\u062a\u0645 \u0627\u0644\u0625\u0631\u0633\u0627\u0644",
        "kpiFailed": "\u0641\u0634\u0644",
        "kpiSkipped": "\u062a\u062e\u0637\u0651\u064a",
        "kpiRevenue": "\u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a",
        "kpiVsPrev24h": "\u0645\u0642\u0627\u0631\u0646\u0629 \u0628\u0627\u0644\u0640 24 \u0633\u0627\u0639\u0629 \u0627\u0644\u0633\u0627\u0628\u0642\u0629",
        "trafficTrendTitle": "\u0627\u062a\u062c\u0627\u0647 \u0627\u0644\u0632\u064a\u0627\u0631\u0627\u062a",
        "trafficPill": "\u0627\u0644\u0632\u064a\u0627\u0631\u0627\u062a",
        "trafficWeeklySubtitle": "\u0625\u062c\u0645\u0627\u0644\u064a \u0623\u0633\u0628\u0648\u0639\u064a \u0644\u0643\u0644 \u0645\u0646\u0635\u0629 \u2022 \u0645\u0642\u0627\u0631\u0646\u0629 \u0627\u0644\u0623\u0633\u0628\u0648\u0639 \u0627\u0644\u062d\u0627\u0644\u064a \u0628\u0627\u0644\u0633\u0627\u0628\u0642",
        "trafficCurWeek": "\u0627\u0644\u0623\u0633\u0628\u0648\u0639 \u0627\u0644\u062d\u0627\u0644\u064a",
        "trafficPrevWeek": "\u0627\u0644\u0623\u0633\u0628\u0648\u0639 \u0627\u0644\u0633\u0627\u0628\u0642",
        "trafficCurWeekDaily": "\u0627\u0644\u0623\u0633\u0628\u0648\u0639 \u0627\u0644\u062d\u0627\u0644\u064a (\u0622\u062e\u0631 7 \u0623\u064a\u0627\u0645\u060c \u0623\u062d\u062f\u0627\u062b/\u064a\u0648\u0645)",
        "trafficPrevWeekDaily": "\u0627\u0644\u0623\u0633\u0628\u0648\u0639 \u0627\u0644\u0633\u0627\u0628\u0642 (\u0645\u0646 7 \u0625\u0644\u0649 14 \u064a\u0648\u0645\u064b\u0627 \u0645\u0636\u062a\u060c \u0623\u062d\u062f\u0627\u062b/\u064a\u0648\u0645)",
        "trafficDaily": "\u064a\u0648\u0645\u064a",
        "trafficWeekly": "\u0623\u0633\u0628\u0648\u0639\u064a",
        "trafficThisWeek": "\u0647\u0630\u0627 \u0627\u0644\u0623\u0633\u0628\u0648\u0639",
        "trafficPreviousWeek": "\u0627\u0644\u0623\u0633\u0628\u0648\u0639 \u0627\u0644\u0633\u0627\u0628\u0642",
        "trafficEmpty": "\u0644\u0627 \u062a\u0648\u062c\u062f \u0632\u064a\u0627\u0631\u0627\u062a \u062e\u0644\u0627\u0644 \u0622\u062e\u0631 7 \u0623\u064a\u0627\u0645.",
        "platformDistTitle": "\u062a\u0648\u0632\u064a\u0639 \u0627\u0644\u0645\u0646\u0635\u0627\u062a",
        "platformDistSubtitle": "\u0622\u062e\u0631 24 \u0633\u0627\u0639\u0629",
        "platformDistPill": "\u0627\u0644\u0645\u0635\u0627\u062f\u0631",
        "platformCardForwarded": "\u0645\u064f\u0631\u0633\u064e\u0644\u0629",
        "platformCardSuccess": "\u0627\u0644\u0646\u062c\u0627\u062d",
        "platformCardRevenue": "\u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a",
        "platformCardLoss": "\u0646\u0633\u0628\u0629 \u0627\u0644\u062a\u062e\u0637\u064a",
        "platformCardNoEvents": "\u0644\u0627 \u062a\u0648\u062c\u062f \u0623\u062d\u062f\u0627\u062b \u0628\u0639\u062f",
        "platformCardNoEventsDesc": "\u0633\u062a\u0638\u0647\u0631 \u0627\u0644\u0623\u062d\u062f\u0627\u062b \u0628\u0645\u062c\u0631\u062f \u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u062a\u062a\u0628\u0639 \u0644\u0647\u0630\u0647 \u0627\u0644\u0645\u0646\u0635\u0629.",

        // Platform help text
        "helpGA4MeasurementId": "\u0645\u0648\u062c\u0648\u062f \u0641\u064a GA4 Admin \u2192 Data Streams \u2192 \u062a\u0641\u0627\u0635\u064a\u0644 \u0628\u062b \u0627\u0644\u0648\u064a\u0628",
        "helpGA4ApiSecret": "GA4 Admin \u2192 Data Streams \u2192 \u0645\u0641\u0627\u062a\u064a\u062d Measurement Protocol API",
        "helpMetaPixelId": "\u0645\u0648\u062c\u0648\u062f \u0641\u064a Meta Events Manager \u2192 Data Sources \u2192 Pixel ID",
        "helpMetaAccessToken": "Meta Events Manager \u2192 Settings \u2192 \u0625\u0646\u0634\u0627\u0621 \u0631\u0645\u0632 \u0648\u0635\u0648\u0644",
        "helpTikTokPixelId": "\u0645\u0648\u062c\u0648\u062f \u0641\u064a TikTok Events Manager \u2192 Web Events \u2192 Pixel ID",
        "helpTikTokAccessToken": "TikTok Events Manager \u2192 Settings \u2192 \u0625\u0646\u0634\u0627\u0621 \u0631\u0645\u0632 \u0648\u0635\u0648\u0644",
        "helpSnapPixelId": "\u0645\u0648\u062c\u0648\u062f \u0641\u064a Snap Ads Manager \u2192 Events Manager \u2192 Pixel ID",
        "helpSnapToken": "Snap Ads Manager \u2192 Events Manager \u2192 \u0631\u0645\u0632 Conversions API",

        // Retry
        "retry": "\u0625\u0639\u0627\u062f\u0629",
        "retrying": "\u062c\u0627\u0631\u064a \u0627\u0644\u0625\u0639\u0627\u062f\u0629...",
        "retrySuccess": "\u062a\u0645\u062a \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062d\u062f\u062b \u0628\u0646\u062c\u0627\u062d.",
        "retryFailed": "\u0641\u0634\u0644\u062a \u0627\u0644\u0625\u0639\u0627\u062f\u0629",

        // Logs
        "logsTitle": "\u0633\u062c\u0644 \u0627\u0644\u0623\u062d\u062f\u0627\u062b",
        "logsLoadingSubtitle": "\u062c\u0627\u0631\u064a \u062a\u062d\u0645\u064a\u0644 \u0633\u062c\u0644 \u0627\u0644\u0623\u062d\u062f\u0627\u062b\u2026",
        "logsEmptySubtitle": "\u0644\u0645 \u064a\u062a\u0645 \u0627\u0633\u062a\u0644\u0627\u0645 \u0623\u064a \u0623\u062d\u062f\u0627\u062b \u0628\u0639\u062f",
        "logsEmptyTitle": "\u0644\u0627 \u062a\u0648\u062c\u062f \u0623\u062d\u062f\u0627\u062b \u0628\u0639\u062f",
        "logsEmptyBody": "\u0633\u062a\u0638\u0647\u0631 \u0627\u0644\u0623\u062d\u062f\u0627\u062b \u0647\u0646\u0627 \u0628\u0645\u062c\u0631\u062f \u0623\u0646 \u064a\u0628\u062f\u0623 \u0645\u062a\u062c\u0631\u0643 \u0641\u064a \u062a\u0644\u0642\u064a \u0627\u0644\u0637\u0644\u0628\u0627\u062a \u0648\u064a\u062a\u0645 \u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u062a\u062a\u0628\u0639.",
        "logsMainSubtitle": "\u0633\u062c\u0644 \u062a\u0641\u0635\u064a\u0644\u064a \u0644\u0625\u0631\u0633\u0627\u0644 \u0623\u062d\u062f\u0627\u062b \u0627\u0644\u062a\u062d\u0648\u064a\u0644",
        "logsSearchPlaceholder": "\u0627\u0628\u062d\u062b \u0628\u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628\u060c \u0627\u0644\u0645\u0646\u0635\u0629\u060c \u0627\u0644\u0646\u0648\u0639\u060c \u0627\u0644\u062d\u0627\u0644\u0629...",
        "logsAllPlatforms": "\u0643\u0644 \u0627\u0644\u0645\u0646\u0635\u0627\u062a",
        "logsAllStatus": "\u0643\u0644 \u0627\u0644\u062d\u0627\u0644\u0627\u062a",
        "logsTime": "\u0627\u0644\u0648\u0642\u062a",
        "logsPlatform": "\u0627\u0644\u0645\u0646\u0635\u0629",
        "logsType": "\u0627\u0644\u0646\u0648\u0639",
        "logsOrderId": "\u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628",
        "logsValue": "\u0627\u0644\u0642\u064a\u0645\u0629",
        "logsStatus": "\u0627\u0644\u062d\u0627\u0644\u0629",
        "logsPayload": "\u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a",
        "logsNoResults": "\u0644\u0627 \u062a\u0648\u062c\u062f \u0646\u062a\u0627\u0626\u062c \u0645\u0637\u0627\u0628\u0642\u0629 \u0644\u0639\u0648\u0627\u0645\u0644 \u0627\u0644\u062a\u0635\u0641\u064a\u0629.",
        "logsShowing": "\u0639\u0631\u0636",
        "logsOf": "\u0645\u0646",
        "logsEvents": "\u0623\u062d\u062f\u0627\u062b",
        "logsRefresh": "\u062a\u062d\u062f\u064a\u062b",
        "logsRefreshing": "\u062c\u0627\u0631\u064a \u0627\u0644\u062a\u062d\u062f\u064a\u062b...",
        "logsViewPayload": "\u0639\u0631\u0636 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a",
        "logsLastAttemptInfo": "\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0622\u062e\u0631 \u0645\u062d\u0627\u0648\u0644\u0629",

        // Status summary
        "statusSuccess": "\u0646\u062c\u0627\u062d",
        "statusFailed": "\u0641\u0634\u0644",
        "statusSkipped": "\u062a\u062e\u0637\u064a",
        "statusPending": "\u0642\u064a\u062f \u0627\u0644\u0627\u0646\u062a\u0638\u0627\u0631",

        // Show / Hide
        "show": "\u0625\u0638\u0647\u0627\u0631",
        "hide": "\u0625\u062e\u0641\u0627\u0621"
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
