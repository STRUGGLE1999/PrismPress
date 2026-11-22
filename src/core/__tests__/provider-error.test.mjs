import { describe, expect, it } from 'vitest'
import { providerError } from '../../../shared/provider-error.mjs'

describe('可操作的服务错误', () => {
  it.each([
    [401, {}, '认证失败'],
    [403, {}, '访问权限'],
    [404, {}, '模型或调用线路'],
    [429, { code: 'insufficient_quota' }, '额度或余额不足'],
    [429, { code: 'rate_limit_exceeded' }, '请求过于频繁'],
    [503, {}, '模型线路暂时不可用'],
  ])('说明 HTTP %i 的原因，不透出原始账户信息', async (status, error, reason) => {
    const response = new Response(JSON.stringify({ error: { ...error, message: 'private-key account-secret' } }), { status })
    const message = await providerError(response, 'AI 提炼')
    expect(message).toContain(reason)
    expect(message).toContain(`HTTP ${status}`)
    expect(message).not.toMatch(/private-key|account-secret/)
  })
  it('上游返回非 JSON 时仍给出状态与处理建议', async () => {
    expect(await providerError(new Response('gateway', { status: 502 }), '封面生成')).toContain('上游服务暂时异常')
  })
})
