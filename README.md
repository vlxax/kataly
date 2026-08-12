# КАТАЛЫ V0.1

Отдельный экспериментальный модуль для Poker Swipe.

## Что уже работает
- Главный экран «Каталы».
- Внутренняя валюта (localStorage demo).
- Создание 6-max / 9-max стола.
- Бай-ин 1 000 / 5 000.
- Стартовый стек 50 / 100 BB.
- Приглашение пользователя по нику (пока локальный mock).
- Автозаполнение свободных мест ботами.
- Лобби real + bot.
- Создание демо-сессии.
- История демо-сессий.
- Каркас будущей статистики.
- Модульная структура, чтобы позже встраивать в Poker Swipe.

## Что намеренно НЕ реализовано в V0.1
- Настоящая синхронизация нескольких устройств.
- Настоящие Supabase-инвайты.
- Poker engine / раздача карт.
- Betting rounds, 3-bet/4-bet, side pots, all-in.
- Hand evaluator.
- Выбывание игроков.
- Выплата призов.
- Poker Brain-анализ реальных решений.

## V0.2 — следующий шаг
1. Полноценная NL Hold'em hand state machine.
2. Колода / dealer button / SB / BB.
3. Preflop → flop → turn → river → showdown.
4. Fold / Check / Call / Bet / Raise / All-in.
5. Минимальный raise и legal-action validation.
6. Hand evaluator.
7. Боты, которые реально принимают решения.
8. Запись каждого action в hand history.

## V0.3
- Supabase Realtime.
- Настоящие real-user invites.
- Синхронизация стола.
- Reconnect.
- Session analytics.
- Poker Brain report.


## V0.3 — PLAYABLE TABLE
Добавлен первый реально играемый single-device NL Hold'em стол:
- 6-max / 9-max из текущего лобби.
- Реальный Hero + боты.
- Колода и раздача hole cards.
- Dealer / SB / BB.
- Preflop → flop → turn → river → showdown.
- Fold / Check / Call / Raise.
- Слайдер рейза.
- Боты принимают базовые решения.
- Банк и стеки меняются.
- Hand evaluator определяет победителя на showdown.
- Следующая раздача.
- Завершение тестовой сессии и запись результата в историю.

Важно: это V0.3 — локальный прототип движка. Side pots, полноценные all-in edge cases,
турнирное выбывание до одного победителя, настоящая сеть и Poker Brain-анализ будут дальше.


## V0.4 — TABLE → RESULT → HISTORY → STATS
- Исправлен реальный переход из лобби на игровой стол.
- После завершения тестовой сессии показывается итог.
- Сохраняются руки, стартовый/финальный стек, BB-результат и игровая награда.
- История сессий стала отдельными карточками.
- Добавлен экран агрегированной статистики.
- Добавлены точки входа в будущий подробный разбор Poker Brain.


## V0.5 — POKER BRAIN / HAND HISTORY
- Сессия теперь хранит все сыгранные руки, а не только последнюю.
- Каждое действие Hero сохраняется с улицей, банком, ценой колла, сайзингом, стеком, картами и бордом.
- После сессии автоматически строится учебная оценка решений.
- Раздельные оценки: префлоп / постфлоп / сайзинг / дисциплина.
- Карточки ошибок и спорных решений.
- Детальный просмотр конкретной раздачи и всей линии действий.
- Первые автоматически найденные лики.
- Кнопка «Лечить» подготовлена под связь с персональными упражнениями.
- Важно: текущий анализ — эвристический прототип, не GTO solver.


## V0.6 — TOURNAMENT MODE
- Blind levels теперь растут автоматически каждые 3 руки.
- Уровни: 1/2 → 2/4 → 3/6 → 5/10 → 8/16 → 12/24 → 20/40.
- Игроки с нулевым стеком реально вылетают.
- На столе показываются текущий уровень, блайнды и сколько игроков осталось.
- Hero-сессия заканчивается при вылете Hero или при победе.
- Рассчитывается итоговое место.
- Призовой фонд распределяется по 1/2/3 местам.
- Приз возвращается во внутренний банкролл.
- В истории сохраняются место, приз, блайнды и турнирный результат.
- В статистике появились победы, ITM и лучшее место.

Ограничения прототипа:
- Side pots и сложные multi-way all-in пока не реализованы.
- Боты пока эвристические, не GTO.
- Реальный realtime multiplayer будет отдельным этапом.

## V0.7 — POKER ENGINE CORE
- Blind levels now advance by real time (5 min demo levels), not by hand count.
- Big Blind Ante.
- Chips + BB display, average stack and tournament clock in engine snapshot.
- 6-max positions and rotating dealer button; heads-up BTN/SB handling.
- Legal action context includes call, min/max raise, pot, BB values and position.
- Raise presets + all-in in the table UI.
- Side-pot construction and split-pot payouts.
- Decision logs now store position, effective stack, BB, pot context and decision time.
- Poker Brain can later consume the richer hand/action log without pretending current heuristic scores are GTO.


## V0.7.2 — SAFARI FIX
- Исправлен Safari/WebKit parse crash.
- Конструкции `pair?.25`, `suited?.07`, `condition?.08` были двусмысленно записанными ternary-выражениями.
- Они заменены на обычные `condition ? value : 0`.


## V0.7.3 — LEGACY SAFARI
- Удалены ВСЕ optional chaining `?.` и nullish coalescing `??`.
- Убраны `flatMap` из критического пути.
- Цель: совместимость со старым Safari/WebKit, а не только современным Chrome.


## V0.7.5 — ENGINE PARSE FIX
- Найдена реальная причина Safari BOOT ERROR.
- В `js/poker/engine.js`, функция `botAction()`, у третьего `return {type:'raise'...}` не хватало одной закрывающей `)`.
- Из-за этого следующий `return` воспринимался Safari как синтаксическая ошибка.
- `botAction()` переписан многострочно, чтобы такая ошибка больше не пряталась в одной гигантской строке.
- Добавлен cache-bust `app.js?v=075-engine-parse-fix`.


## V0.8 — POKER ENGINE CORE

Главная цель этой версии: отделить покерную логику от красивого UI и сделать движок, который может честно провести раздачу.

### Переписано
- `js/poker/engine.js` переписан с нуля в читаемом виде.
- Корректная колода из 52 уникальных карт.
- Dealer button / SB / BB / Big Blind Ante.
- Preflop → Flop → Turn → River.
- Burn card перед каждой общей улицей.
- Fold / Check / Call / Raise / All-in.
- Проверка illegal check / illegal raise.
- Min raise / max raise.
- All-in состояние игрока.
- Закрытие betting round только после уравнивания ставок.
- Showdown и сравнение комбинаций.
- Split pot.
- Базовые side pots для разных размеров all-in.
- Odd chips распределяются по одному.
- Движение button после руки.
- Вылеты игроков и место в турнире.
- Таймер blind levels сохранён.
- Hand history сохраняет каждое решение Hero.

### Важно
Боты пока специально простые. Их задача сейчас — не играть идеально, а не ломать покерный протокол.
Следующий слой: разные bot personalities и более покерные диапазоны решений.


## V0.8.1 — ENGINE AUDIT FIX

Проведён полный аудит V0.8 после реального теста в браузере.

Исправлено:
- Тестовая валюта больше НЕ блокирует вход за стол.
- Старый localStorage с нулевым банкроллом автоматически получает 1 000 000 тестовых монет.
- В тестовом режиме buy-in не списывается.
- Big Blind Ante теперь dead money и НЕ увеличивает preflop call с 1 BB до 2 BB.
- Карты раздаются по кругу в два прохода: каждый активный игрок гарантированно получает ровно 2 карты.
- Blind level больше не меняется посреди текущей раздачи.
- Если все соперники all-in, борд доезжает автоматически без бессмысленных CHECK.
- Short all-in raise больше не считается полноценным re-open action.
- Полный raise корректно возвращает право рейза остальным.
- Выход со стола останавливает движок и таймер.
- Сессия больше не путает фишки и BB в итоговой статистике.

Добавлены автоматические тесты:
- уникальность 52 карт;
- 6-max и 9-max;
- несколько последовательных рук;
- BBA не влияет на размер preflop call;
- chip conservation;
- side-pot conservation;
- evaluator sanity checks;
- stress run турнира до завершения.


## V0.9 — REAL TABLE / POKER ROOM FLOW

Причина отсутствующих кнопок в V0.8.x найдена:
- `onHeroDecision()` рисовал кнопки,
- но таймер движка делал `emit()` каждую секунду,
- `render()` перерисовывал весь стол и заменял action panel обратно на «Боты думают…».
То есть движок ждал решение Hero, а UI сам стирал кнопки.

Исправлено:
- pending Hero decision хранится отдельно и переживает любые re-render.
- FOLD / CHECK / CALL / BET / RAISE / ALL-IN всегда видны именно в ход Hero.
- 25 / 33 / 50 / 66 / POT / ALL-IN.
- raise slider.
- 18 секунд на решение; по таймауту CHECK или FOLD.
- подсветка игрока, чей сейчас ход.
- турнирный HUD: level, countdown, blinds, BBA, players.
- pot в фишках и BB.
- stacks в фишках и BB.
- positions BTN/SB/BB/UTG/HJ/CO.
- effective stack Hero.
- ставки рядом с игроками.
- action tags.
- compact hand history.
- после руки новая раздача начинается автоматически, как в poker-room, без модалки каждый раз.
- отдельный Tournament Info по тапу на верхний HUD.

Дизайн не копирует конкретный рум один-в-один: взята информационная архитектура настоящего мобильного poker-room и адаптирована под KATALY.


## V0.9.1 — DEAL FLOW / STEP 1

Не трогаем весь poker-room сразу. Эта версия чинит только первый игровой ритм.

Что изменено:
- стол больше не меняет геометрию, когда появляются кнопки;
- верх, сукно, Hero и action panel закреплены по координатам;
- новая рука сначала входит в фазу `dealing`;
- карты появляются по местам по одной, в два круга;
- только после визуальной раздачи начинается preflop action;
- решения ботов замедлены примерно до 0.9–1.8 сек, чтобы действия можно было увидеть;
- внизу пишется, кто сейчас принимает решение;
- Hero-кнопки появляются только когда очередь реально дошла до Hero;
- после flop / turn / river есть короткая пауза перед действием.

Это первый шаг к ритму реального мобильного poker-room: deal → wait → actions → board → actions.


## V1.0 — TABLE REBUILD

Полная пересборка одного 6-max poker-room table по event-driven архитектуре.

Архитектура:
PokerEngine → PokerEventBus → TableController → TableView

Ключевые изменения:
- TableView создаёт DOM один раз и больше не перерисовывает весь стол.
- Карты, стеки, ставки и action labels обновляются адресно.
- Добавлен PokerEventBus.
- Engine эмитит события HAND_STARTED / FORCED_BET / CARD_DEALT / TURN_STARTED /
  PLAYER_FOLDED / PLAYER_CHECKED / PLAYER_CALLED / PLAYER_RAISED / PLAYER_ALLIN /
  BETTING_ROUND_COMPLETE / STREET_STARTED / BOARD_CARD_DEALT / SHOWDOWN_STARTED /
  CARDS_REVEALED / POT_AWARDED / HAND_FINISHED.
- Исправлен пропущенный flop betting round.
- Раздача: forced bets → 2 круга карт → preflop action → flop action → turn action → river action → showdown.
- Hero controls появляются только в ход Hero.
- RAISE drawer открывается отдельно, как в реальном руме.
- Новая рука стартует автоматически после короткой паузы.

## V1.0.1 — ONE HAND POLISH
- Hero hole cards have one visual source only.
- Cards now animate from a visible deck origin.
- Forced bets/calls/raises get chip-motion feedback.
- End of each betting round animates committed bets toward the pot.
- Preflop raise presets: 2x / 2.2x / 2.5x / 3x / all-in.
- Postflop presets: 25 / 33 / 50 / 66 / pot / all-in.
- 18-second turn ring restored.
- Hand history records potBefore, potAfter, decisionMs, playersInHand, effectiveStackBB.
- Bots now use current made-hand rank postflop instead of only starting-hand strength.


## V1.1.3
Исправлен parser error в js/poker/tableView.js: удалена лишняя закрывающая фигурная скобка в конце файла.
