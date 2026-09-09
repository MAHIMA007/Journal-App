import './Avatar.css'

function Avatar({ avatar, size = 'small' }) {
  if (typeof avatar === 'string' && avatar.startsWith('data:image/')) {
    return <img className={`memoir-avatar memoir-avatar-${size}`} src={avatar} alt="Your profile" />
  }

  if (avatar?.type !== 'builder') {
    return <span className={`memoir-avatar memoir-avatar-${size} memoir-avatar-empty`}>👤</span>
  }

  const avatarStyle = {
    '--avatar-skin': avatar.skin,
    '--avatar-hair': avatar.hairColor,
    '--avatar-outfit': avatar.outfit,
    '--avatar-backdrop': avatar.backdrop
  }

  return (
    <span className={`memoir-avatar memoir-avatar-${size} memoir-avatar-built`} style={avatarStyle} aria-label="Your custom avatar">
      <span className={`memoir-avatar-hair memoir-avatar-hair-${avatar.hair}`} />
      <span className="memoir-avatar-face">
        <span className={`memoir-avatar-eyes memoir-avatar-eyes-${avatar.eyes}`} />
        <span className="memoir-avatar-smile" />
      </span>
      <span className="memoir-avatar-outfit" />
    </span>
  )
}

export default Avatar