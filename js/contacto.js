/**
 * Validación en cliente del formulario de contacto.
 * Sin backend: valida nombre, email y mensaje antes de permitir el envío simulado.
 */

(function () {
  const form = document.getElementById('form-contacto');
  const estado = document.getElementById('estado-formulario');

  const campos = {
    nombre: { id: 'nombre', min: 3 },
    email: { id: 'email' },
    mensaje: { id: 'mensaje', min: 10 }
  };

  const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function limpiarError(id) {
    const input = document.getElementById(id);
    const error = document.getElementById('error-' + id);
    if (input) input.classList.remove('invalido');
    if (error) error.style.display = 'none';
  }

  function mostrarError(id, mensaje) {
    const input = document.getElementById(id);
    const error = document.getElementById('error-' + id);
    if (input) {
      input.classList.add('invalido');
      input.setAttribute('aria-invalid', 'true');
    }
    if (error) {
      error.textContent = mensaje;
      error.style.display = 'block';
    }
  }

  function validarCampo(id, valor) {
    const campo = campos[id];
    if (!campo) return true;

    if (!valor || valor.trim().length === 0) {
      mostrarError(id, 'Este campo es obligatorio.');
      return false;
    }

    if (campo.min && valor.trim().length < campo.min) {
      mostrarError(id, 'Mínimo ' + campo.min + ' caracteres.');
      return false;
    }

    if (id === 'email' && !regexEmail.test(valor.trim())) {
      mostrarError(id, 'Ingresá un correo electrónico válido.');
      return false;
    }

    limpiarError(id);
    return true;
  }

  function validarTodo() {
    let valido = true;
    Object.keys(campos).forEach(function (id) {
      const input = document.getElementById(campos[id].id);
      const valor = input ? input.value : '';
      if (!validarCampo(id, valor)) valido = false;
    });
    return valido;
  }

  // Limpiar errores al escribir
  Object.values(campos).forEach(function (campo) {
    const input = document.getElementById(campo.id);
    if (input) {
      input.addEventListener('input', function () {
        limpiarError(campo.id);
      });
    }
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    estado.textContent = '';
    estado.className = '';

    if (!validarTodo()) {
      estado.textContent = 'Corregí los errores marcados antes de enviar.';
      estado.className = 'error';
      return;
    }

    // Envío simulado (sin backend)
    estado.textContent = 'Mensaje validado correctamente. Gracias por escribir.';
    estado.className = 'exito';
    form.reset();
  });
})();
