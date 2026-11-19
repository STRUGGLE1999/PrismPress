/**
 * LaTeX → 内联 SVG 渲染器
 *
 * 微信公众号只认内联样式、不加载 KaTeX CSS，因此公式必须编译为带完整
 * <defs> 路径的独立 SVG。这里使用 MathJax 3 的 liteAdaptor，纯前端运行。
 * 首次调用时才动态加载 MathJax，避免拖慢工作台首屏。
 */

interface MathJaxRuntime {
  adaptor: {
    outerHTML: (node: unknown) => string
  }
  document: {
    convert: (
      tex: string,
      options: { display: boolean; em: number; ex: number; containerWidth: number },
    ) => unknown
  }
}

export interface FormulaSvg {
  svg: string | null
  error: boolean
}

let runtimePromise: Promise<MathJaxRuntime | null> | null = null
let formulaSeed = 0
const cache = new Map<string, FormulaSvg>()

async function loadRuntime(): Promise<MathJaxRuntime | null> {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      try {
        const [{ mathjax }, { TeX }, { SVG }, { liteAdaptor }, { RegisterHTMLHandler }, { AllPackages }, { SafeHandler }] =
          await Promise.all([
            import('mathjax-full/js/mathjax.js'),
            import('mathjax-full/js/input/tex.js'),
            import('mathjax-full/js/output/svg.js'),
            import('mathjax-full/js/adaptors/liteAdaptor.js'),
            import('mathjax-full/js/handlers/html.js'),
            import('mathjax-full/js/input/tex/AllPackages.js'),
            import('mathjax-full/js/ui/safe/SafeHandler.js'),
          ])

        const adaptor = liteAdaptor()
        SafeHandler(RegisterHTMLHandler(adaptor))
        const tex = new TeX({ packages: AllPackages })
        const svg = new SVG({ fontCache: 'local' })
        const doc = mathjax.document('', { InputJax: tex, OutputJax: svg })
        return {
          adaptor,
          document: doc as unknown as MathJaxRuntime['document'],
        } as unknown as MathJaxRuntime
      } catch (error) {
        console.warn('[PrismPress] MathJax 加载失败，公式将降级为文本。', error)
        return null
      }
    })()
  }
  return runtimePromise
}

function tagSvgIds(svg: string): string {
  const prefix = `pp-math-${formulaSeed++}`
  return svg
    .replace(/\bid="([^"]+)"/g, (_match, id: string) => `id="${prefix}-${id}"`)
    .replace(/\b(xlink:)?href="#([^"]+)"/g, (_match, xlink: string | undefined, id: string) => {
      const attr = xlink ? 'xlink:href' : 'href'
      return `${attr}="#${prefix}-${id}"`
    })
}

export async function renderTexToSvg(tex: string, display: boolean): Promise<FormulaSvg> {
  const key = `${display ? 'block' : 'inline'}:${tex}`
  const cached = cache.get(key)
  if (cached) {
    // 同一公式在文中出现多次时，重新加 ID 前缀，避免 SVG 内部 id 重复
    return cached.svg ? { svg: tagSvgIds(cached.svg), error: cached.error } : cached
  }

  const runtime = await loadRuntime()
  if (!runtime) {
    const fallback = { svg: null, error: true }
    cache.set(key, fallback)
    return fallback
  }

  try {
    const node = runtime.document.convert(tex, {
      display,
      em: 16,
      ex: 8,
      containerWidth: 1200,
    })
    const html = runtime.adaptor.outerHTML(node)
    const match = html.match(/<svg[\s\S]*<\/svg>/)
    if (!match || html.includes('data-mjx-error')) {
      const failed = { svg: null, error: true }
      cache.set(key, failed)
      return failed
    }

    // MathJax's safe extension does not normalize embedded controls or HTML entities.
    // Only serialized fragment references and explicit HTTP(S) URLs may reach the DOM.
    const safeSvg = match[0].replace(/\b((?:xlink:)?href)="([^"]*)"/gi, (_attribute, name: string, value: string) => {
      const normalized = value.replace(/[\u0000-\u0020\u007f]/g, '')
      return /^(?:#|https?:\/\/)/i.test(normalized) ? `${name}="${normalized}"` : ''
    })
    let svg = tagSvgIds(safeSvg)
    if (display) {
      svg = svg.replace(/style="[^"]*"/, 'style="display:block;margin:12px auto;max-width:100%;height:auto;"')
    } else {
      svg = svg.replace(/style="([^"]*)"/, 'style="$1;max-width:100%;height:auto;"')
    }
    const result = { svg, error: false }
    cache.set(key, result)
    return result
  } catch (error) {
    console.warn('[PrismPress] 公式渲染失败：', tex, error)
    const failed = { svg: null, error: true }
    cache.set(key, failed)
    return failed
  }
}
