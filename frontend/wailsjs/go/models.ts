export namespace clickhouse {
	
	export class QueryResult {
	    Type: string;
	    Columns: string[];
	    Data: any[];
	
	    static createFrom(source: any = {}) {
	        return new QueryResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Type = source["Type"];
	        this.Columns = source["Columns"];
	        this.Data = source["Data"];
	    }
	}

}

