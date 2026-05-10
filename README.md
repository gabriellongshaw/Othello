# Othello

A web-based Othello (Reversi) game with three ways to play: local two-player, online multiplayer via Firebase, and solo against a bot.

## How to Play

Place discs on the 8×8 board. A move is valid if it flanks at least one of your opponent's discs in a straight line (horizontal, vertical, or diagonal). All flanked discs flip to your colour. If you have no valid moves, your turn is skipped. The game ends when neither player can move. The player with the most discs wins.

**Preview system:** hover a square to see which discs would flip. Click once to select and preview your move (with a Send button appearing to confirm), or click the same square again to send immediately. Click a different square to change your selection before sending.

## Game Modes

### Local

Pass-and-play on the same device. Player 1 plays as Black and Player 2 plays as White.

### Online

Real-time multiplayer powered by Firebase Firestore. One player creates a game and shares the room code. The other enters the code to join. Player 1 (host) plays as Black. Only the host can restart the game.

### vs Bot

Solo play against an AI. You play as Black; the bot plays as White. Five difficulty levels:

- **Easy** — mostly random, rarely threatens
- **Medium** — basic strategy with some mistakes
- **Hard** — solid positional play using minimax (depth 5)
- **Expert** — deeper search (depth 7), plays strong corners-first strategy
- **Impossible** — full-depth minimax (depth 9), very hard to beat

## Leaderboard

Tracks wins and draws for the current session above the board. Resets when you leave.

## Credits

Created by [Gabriel Longshaw](https://www.gabriellongshaw.co.uk)