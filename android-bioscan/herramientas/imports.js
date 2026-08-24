/**
 * Busca simbolos de Compose usados en un archivo Kotlin que no esten importados.
 *
 * No es un compilador: solo cubre los nombres que mas se olvidan. Pero cuando no se puede
 * compilar en local, caza en un segundo lo que si no cuesta una vuelta entera de CI.
 *
 * Tres filtros, y los tres salieron de falsos positivos reales:
 *
 *   - Fuera los comentarios. "en una Row se separarian" no es usar Row.
 *
 *   - Distinguir LLAMADA de PROPIEDAD por el parentesis. `bitmap.width` es leer una
 *     propiedad y no necesita import; `Modifier.width(8.dp)` es una extension y si lo
 *     necesita. Las dos llevan punto delante, asi que lo que las separa es el parentesis.
 *
 *   - Las extensiones de Modifier SOLO cuentan con parentesis, porque su nombre aparece
 *     tambien como argumento con nombre: `darkColorScheme(background = ...)` no importa
 *     nada.
 */
const fs = require('fs');

/** Tipos y funciones que se escriben sueltos: `Column(`, `Color.White`, `Alignment.Center`. */
const TIPOS = [
  'IntrinsicSize', 'Spacer', 'Box', 'Column', 'Row', 'Arrangement', 'Alignment',
  'PaddingValues', 'Brush', 'Color', 'ContentScale', 'Modifier', 'CircleShape',
  'RoundedCornerShape', 'MaterialTheme', 'Text', 'Card', 'CardDefaults', 'Button',
  'ButtonDefaults', 'Icon', 'IconButton', 'TextButton', 'Surface', 'Image', 'AsyncImage',
  'HorizontalDivider', 'Switch', 'Scaffold', 'TopAppBar', 'TopAppBarDefaults',
  'OutlinedTextField', 'OutlinedTextFieldDefaults', 'OutlinedButton',
  'CircularProgressIndicator', 'LinearProgressIndicator', 'FontWeight', 'FontStyle',
  'TextAlign', 'painterResource', 'buildAnnotatedString', 'SpanStyle', 'withStyle',
  'Canvas', 'StrokeCap', 'Offset', 'Rect', 'IntSize', 'ImageVector', 'KeyboardOptions',
  'KeyboardActions', 'ImeAction', 'Bitmap', 'Matrix', 'Uri', 'LazyColumn', 'remember',
  'mutableStateOf', 'Composable', 'viewModel', 'FileProvider', 'detectDragGestures',
];

/**
 * Extensiones de Modifier: solo cuentan cuando llevan parentesis.
 *
 * NO van aqui `weight` ni `align`: son miembros de RowScope y BoxScope, no extensiones,
 * y no se importan. Ponerlos daba un aviso en casi cada archivo.
 */
const ENCADENABLES = [
  'fillMaxSize', 'fillMaxWidth', 'fillMaxHeight', 'heightIn', 'widthIn', 'clip',
  'background', 'border', 'padding', 'size', 'width', 'height', 'clickable',
  'verticalScroll', 'rememberScrollState', 'onSizeChanged', 'pointerInput',
  'asImageBitmap', 'collectAsStateWithLifecycle',
];

let fallos = 0;

for (const archivo of process.argv.slice(2)) {
  const bruto = fs.readFileSync(archivo, 'utf8');

  const importados = new Set(
    [...bruto.matchAll(/^import\s+([\w.]+)/gm)].map((m) => m[1].split('.').pop())
  );

  const propios = new Set(
    [
      ...bruto.matchAll(
        /^(?:private |internal |public )?(?:fun|val|var|class|object|enum class|data class|sealed interface|interface)\s+(\w+)/gm
      ),
    ].map((m) => m[1])
  );

  const cuerpo = bruto
    .replace(/^import[^\n]*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

  const falta = (simbolo, soloLlamada) => {
    if (importados.has(simbolo) || propios.has(simbolo)) return false;
    if (new RegExp(`\\.${simbolo}\\s*\\(`).test(cuerpo)) return true;
    return !soloLlamada && new RegExp(`(?<![.\\w])${simbolo}\\b`).test(cuerpo);
  };

  const faltan = [
    ...TIPOS.filter((s) => falta(s, false)),
    ...ENCADENABLES.filter((s) => falta(s, true)),
  ];

  if (faltan.length) {
    fallos += 1;
    console.log(`${archivo.split(/[\\/]/).pop()}: FALTA IMPORTAR -> ${faltan.join(', ')}`);
  }
}

if (fallos === 0) console.log('todos los simbolos habituales estan importados');
process.exit(fallos ? 1 : 0);
