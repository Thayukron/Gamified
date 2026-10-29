import { levelInfo, type Avatar } from '~/utils/progression'

interface Player { xp: number; coins: number; avatar: Avatar | null }

/** Shared player progression (XP, coins, avatar) for the logged-in student. */
export function usePlayer() {
  const api = useApi()
  const player = useState<Player | null>('player', () => null)

  async function load() {
    player.value = (await api('/student/player')).player
    return player.value
  }

  async function saveAvatar(avatar: Avatar) {
    const res = await api('/student/player/avatar', { method: 'PUT', body: avatar })
    if (player.value) player.value.avatar = res.avatar
    return res.avatar as Avatar
  }

  const level = computed(() => levelInfo(player.value?.xp ?? 0))

  return { player, level, load, saveAvatar }
}
