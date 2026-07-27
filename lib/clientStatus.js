export const NEW_CLIENT_STATUS = 'potential'

export function isNewClient(client) {
  return client?.client_status === NEW_CLIENT_STATUS
}
