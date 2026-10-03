import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover' },
      { name: 'theme-color', content: '#000000' },
      { title: 'Stage Clock' },
    ],
    links: [
      { rel: 'preload', href: '/fonts/DSEG7Classic-Bold.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  shellComponent: RootDocument,
})

// iOS Safari ignores user-scalable=no, so cancel pinch gestures directly. Also blocks
// trackpad pinch (ctrl+wheel) on desktop.
const NO_ZOOM_SCRIPT = `(function(){var o={passive:false};function no(e){e.preventDefault()}
document.addEventListener('gesturestart',no,o);document.addEventListener('gesturechange',no,o);
document.addEventListener('touchmove',function(e){if(e.touches.length>1)e.preventDefault()},o);
window.addEventListener('wheel',function(e){if(e.ctrlKey)e.preventDefault()},o);})();`

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: NO_ZOOM_SCRIPT }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
