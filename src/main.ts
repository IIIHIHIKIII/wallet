import Vue from 'vue';
import VueCompositionApi from '@vue/composition-api';
// @ts-ignore Could not find a declaration file for module 'vue-virtual-scroller'.
import VueVirtualScroller from 'vue-virtual-scroller';

import App from './App.vue';
import './registerServiceWorker';
import { initStorage } from './storage';
import { syncFromHub } from './hub';
import { launchNetwork } from './network';
import { useFiatStore } from './stores/Fiat';
import { useSettingsStore } from './stores/Settings';
import router from './router';
import { i18n, loadLanguage } from './i18n/i18n-setup';
import { startSentry } from './lib/Sentry';

import '@nimiq/style/nimiq-style.min.css';
import '@nimiq/vue-components/dist/NimiqVueComponents.css';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';
import '@/assets/css/main.css';
import '@/scss/themes.scss';

declare global {
    interface Window {
        NIMIQ_IQONS_SVG_PATH: string;
    }
}

// Specify where the svg asset for the Nimiq identicons is located.
// The file gets copied to this location via the copy-webpack-plugin
// as specified in vue.config.js
window.NIMIQ_IQONS_SVG_PATH = '/img/iqons.min.svg';

Vue.config.productionTip = false;

Vue.use(VueCompositionApi);
Vue.use(VueVirtualScroller);

initStorage();
syncFromHub();
const { timestamp: lastExchangeRateUpdateTime, updateExchangeRates } = useFiatStore();

// Update exchange rates every 2 minutes. If the last update was
// less than 2 minutes ago, wait the remaining time first.
window.setTimeout(
    () => {
        updateExchangeRates();
        setInterval(() => updateExchangeRates(), 2 * 60 * 1000); // update every 2 min
    },
    Math.max(0, lastExchangeRateUpdateTime.value + 2 * 60 * 1000 - Date.now()),
);

// Fetch language file
const { language } = useSettingsStore();
loadLanguage(language.value);

startSentry(Vue);

const app = new Vue({
    router,
    i18n,
    render: (h) => h(App),
}).$mount('#app');

router.afterEach((to, from) => {
    // console.debug('route-changed', from, to);
    app.$emit('route-changed', to, from);
});

launchNetwork();

declare module '@vue/composition-api/dist/component/component' {
    interface SetupContext {
        readonly refs: { [key: string]: Vue | Element | Vue[] | Element[] };
    }
}

router.onReady(() => {
    // console.debug(router.currentRoute, window.history.state);

    // Vue-Router sets a history.state. If a state exists, this means this was
    // a page-reload and we don't need to set up the initial routing anymore.
    if (window.history.state) return;

    if (router.currentRoute.path !== '/') {
        const startRoute = router.currentRoute.fullPath;
        app.$once('route-changed', () => Vue.nextTick().then(() => {
            // Use push, so the user is able to use the OS' back button.
            // Use fullpath to also capture query params, like used in payment links.
            router.push(startRoute);
        }));
    }
    router.replace('/').catch(() => { /* ignore */ }); // Make sure to remove any query params, like ?sidebar.
});
