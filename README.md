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
