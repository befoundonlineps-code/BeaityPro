import { getAvatarColor, getInitials } from '../lib/avatarColor'
import { clientCard, clientCardHead, avatarCircle, clientCardName, clientCardMeta, clientCardFooter, detailsLink } from '../styles'

export default function ClientCard({ client, onOpen }) {
  const initials = getInitials(client.first_name, client.last_name)
  const color = getAvatarColor(client.id || client.phone_number)

  return (
    <div style={clientCard} onClick={() => onOpen(client)}>
      <div style={clientCardHead}>
        <div style={avatarCircle(color)}>{initials}</div>
        <div>
          <div style={clientCardName}>{client.first_name} {client.last_name}</div>
          {client.email && <div style={clientCardMeta}>✉ {client.email}</div>}
        </div>
      </div>
      <div style={clientCardFooter}>
        <span style={clientCardMeta}>☎ {client.phone_number}</span>
        <button style={detailsLink} onClick={(e) => { e.stopPropagation(); onOpen(client) }}>التفاصيل ‹</button>
      </div>
    </div>
  )
}
