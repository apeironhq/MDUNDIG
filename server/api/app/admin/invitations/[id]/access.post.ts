export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event)
  const id = uuidParam(getRouterParam(event, 'id'))
  const body = await readJson(event)
  const userId = uuidParam(body.user_id, 'user_id')
  const { error } = await user.db.from('invitation_access').insert({ invitation_id: id, user_id: userId, granted_by: user.id })
  if (error) throw dbError(error)
  await audit(user, 'access.grant', id, { user_id: userId })
  setResponseStatus(event, 201)
  return { ok: true }
})
