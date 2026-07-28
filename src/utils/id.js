let _lastId = 0

export default function gerarId() {
  const now = Date.now()
  _lastId = now > _lastId ? now : _lastId + 1
  return _lastId
}
