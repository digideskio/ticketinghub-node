uid = 0;

class Request

  constructor: (method, url) ->
    if 'withCredentials' in (new XMLHttpRequest)
      new Promise (resolve, reject) ->
        xhr = new XMLHttpRequest

        handler = ->
          if @readyState == @DONE
            if @status == 200
              resolve @response
            else
              reject new Error("#{method.toUpperCase()} `#{url}` failed with status: [#{@status}]")
          return

        xhr.open method.toUpperCase(), url
        xhr.onreadystatechange = handler
        xhr.responseType = 'json'
        xhr.setRequestHeader 'Accept', 'application/json'
        xhr.send()
