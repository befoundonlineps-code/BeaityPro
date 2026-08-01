import { appWithTranslation } from 'next-i18next'
import { DirectionProvider } from '@base-ui/react/direction-provider'
import '../styles/globals.css'
import nextI18NextConfig from '../next-i18next.config'

// Base UI does not read `dir` off the DOM. useDirection() falls back to 'ltr'
// whenever no DirectionProvider is above it, so `<Html dir="rtl">` in
// _document tells the browser everything and this library nothing — every
// popup that positions itself on a logical side lands mirrored. Submenus
// opened to the right of their parent, away from the reading direction,
// which is how this surfaced.
//
// It belongs here rather than beside the one menu that exposed it: anything
// from this library that anchors itself needs the same answer.
function App({ Component, pageProps }) {
  return (
    <DirectionProvider direction="rtl">
      <Component {...pageProps} />
    </DirectionProvider>
  )
}

export default appWithTranslation(App, nextI18NextConfig)
