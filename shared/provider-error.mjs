/** Explain provider failures without forwarding credentials or raw account messages. */
export async function providerError(response, service) {
  let hint = ''
  try {
    const body = await response.json()
    hint = [body.error?.code, body.error?.type, body.error?.message, typeof body.error === 'string' ? body.error : ''].join(' ').toLowerCase()
  } catch {}
  const status = response.status
  let reason
  if (status === 401) reason = '服务认证失败，请联系网站管理员检查 API 密钥'
  else if (status === 403) reason = '当前账户没有访问权限，请检查服务权限或账户限制'
  else if (status === 404 || /model_not_found|no available channel|无可用渠道/.test(hint)) reason = '模型或调用线路不可用，请检查模型名称和令牌分组'
  else if (/insufficient_quota|quota_exceeded|insufficient.*balance|额度不足|余额不足/.test(hint)) reason = '服务额度或余额不足，请补充额度后重试'
  else if (status === 429) reason = '请求过于频繁或已达到调用额度，请稍后重试或检查额度'
  else if (status === 400 || status === 422) reason = '服务拒绝了请求参数，请检查模型、文章长度和生成选项'
  else if (status === 503) reason = '模型线路暂时不可用，请稍后重试；持续失败时请检查令牌分组'
  else if (status >= 500) reason = '上游服务暂时异常，请稍后重试'
  else reason = '服务未能完成请求，请联系网站管理员检查服务配置'
  return `${service}失败：${reason}（HTTP ${status}）`
}
