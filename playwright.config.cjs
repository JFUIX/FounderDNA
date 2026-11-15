const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./tests',timeout:45000,workers:2,
 use:{browserName:'chromium',screenshot:'only-on-failure',trace:'retain-on-failure'},
 webServer:{command:'npm run serve',url:'http://127.0.0.1:8765',reuseExistingServer:!process.env.CI,timeout:15000}
});
