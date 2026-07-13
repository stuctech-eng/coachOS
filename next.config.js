/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: false,
  // v2.4.63: TIJDELIJK volledig uitgeschakeld. skipWaiting: false
  // (v2.4.62) loste het "pagina reset zichzelf"-probleem niet volledig
  // op — bleef nog gedeeltelijk optreden ("even staan, dan terugspringen").
  // In plaats van verder te gokken naar de exacte resterende oorzaak
  // (kon de live service worker niet inspecteren, geen tool-toegang tot
  // het Vercel-domein): de service worker staat nu volledig uit tijdens
  // de specialistlaag-testfase. Zet terug naar `false` (of verwijder deze
  // regel) zodra alle specialist-stappen getest en stabiel zijn — PWA/
  // offline-functionaliteit is dan weer nodig voor productiegebruik.
  disable: true,
})

const nextConfig = {
  reactStrictMode: true,
}

module.exports = withPWA(nextConfig)
