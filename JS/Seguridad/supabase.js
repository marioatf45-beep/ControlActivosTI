(function (global) {
    "use strict";

    const url = "https://jxknzmeqanrgxuqzbzut.supabase.co";
    const publishableKey = "sb_publishable_dTzR9pozFTs6G8w9c17y7w_76WOADJO";

    Object.keys(localStorage)
        .filter(key => /^sb-.*-auth-token$/.test(key))
        .forEach(key => localStorage.removeItem(key));

    if (!global.supabase?.createClient) {
        throw new Error("No fue posible cargar el cliente de Supabase.");
    }

    global.ControlTISupabase = {
        url,
        publishableKey,
        client: global.supabase.createClient(url, publishableKey, {
            auth: {
                persistSession: true,
                storage: sessionStorage,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        })
    };
})(window);
